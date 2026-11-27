import { randomUUID } from "node:crypto";
import { assertEncryptedStorageReady, lockFinancialOwner, markEncryptedWriter } from "./financial-records.mjs";

// Each occurrence owns its database transaction. A worker can restart after
// any occurrence without re-creating already recorded or skipped entries.
export async function processEncryptedWorkflows(sql, cipher, recordTransaction, {
  runUntil = new Date().toISOString(),
  ownerId = null,
  maxOccurrences = 100,
} = {}) {
  if (!Number.isSafeInteger(maxOccurrences) || maxOccurrences < 1 || maxOccurrences > 500) {
    throw new Error("Invalid encrypted workflow batch size");
  }

  await assertEncryptedStorageReady(sql);
  let processed = 0;
  let retrying = 0;
  for (let attempted = 0; attempted < maxOccurrences; attempted++) {
    const outcome = await sql.begin(async (tx) => {
      const [candidate] = await tx`
        select id, user_id from public.workflows where next_run_at <= ${runUntil}::timestamptz
          and (processing_retry_after is null or processing_retry_after <= now())
          and (${ownerId}::uuid is null or user_id = ${ownerId}::uuid)
        order by next_run_at, id limit 1
      `;
      if (!candidate) return "empty";
      await markEncryptedWriter(tx);
      await lockFinancialOwner(tx, candidate.user_id);
      const [workflow] = await tx`
        select workflow.id::text, workflow.user_id::text, workflow.next_run_at::text as due,
          (workflow.next_run_at at time zone (workflow.schedule->>'timeZone'))::date::text as local_day,
          public.next_workflow_run(workflow.schedule, workflow.next_run_at)::text as next_run,
          payload.envelope
        from public.workflows workflow
        left join expenser_private.financial_payloads payload
          on payload.record_kind = 'workflows'
          and payload.owner_id = workflow.user_id and payload.record_id = workflow.id::text
        where workflow.id = ${candidate.id} and workflow.next_run_at <= ${runUntil}::timestamptz
          and (workflow.processing_retry_after is null or workflow.processing_retry_after <= now())
          and (${ownerId}::uuid is null or workflow.user_id = ${ownerId}::uuid)
        order by workflow.next_run_at, workflow.id
        limit 1 for update of workflow skip locked
      `;
      if (!workflow) return "claimed";

      try {
        await tx.savepoint(async (occurrenceTx) => {
          const [occurrence] = await occurrenceTx`
            insert into public.workflow_occurrences (user_id, workflow_id, local_date, scheduled_at, status)
            values (${workflow.user_id}, ${workflow.id}, ${workflow.local_day}, ${workflow.due}, 'recorded')
            on conflict (workflow_id, local_date) do nothing
            returning id
          `;
          if (!occurrence) return;

          const fields = cipher.open({
            kind: "workflows", ownerId: workflow.user_id, recordId: workflow.id,
          }, workflow.envelope);
          const transactionId = randomUUID();
          await recordTransaction(occurrenceTx, {
            ownerId: workflow.user_id,
            transactionId,
            date: workflow.due,
            fields: {
              type: fields.type,
              amount: fields.amount,
              description: fields.description || fields.name,
              category: fields.category,
              payment_method: fields.payment_method,
              split_amount: fields.split_amount,
              client_request_id: `wf_${workflow.id}_${workflow.local_day}`,
            },
          });
          await occurrenceTx`
            update public.workflow_occurrences set transaction_id = ${transactionId}
            where id = ${occurrence.id}
          `;
        });
      } catch {
        await tx`
          update public.workflows set processing_retry_after = now() + interval '5 minutes'
          where id = ${workflow.id}
        `;
        return "retry";
      }

      await tx`
        update public.workflows set next_run_at = ${workflow.next_run}, processing_retry_after = null
        where id = ${workflow.id}
      `;
      return "processed";
    });
    if (outcome === "empty") break;
    if (outcome === "retry") retrying++;
    else if (outcome === "processed") processed++;
  }
  return { processed, retrying };
}
