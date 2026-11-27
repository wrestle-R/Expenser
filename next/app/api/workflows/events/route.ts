import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import type { TransactionRow, WorkflowRow } from '@/lib/db';
import { financialRead, financialWrite, hydrate } from '@/lib/financial-db';
import { refreshEncryptedBalances } from '@/lib/encrypted-transaction-storage.mjs';
import { runEncryptedWorkflows } from '@/lib/run-encrypted-workflows';

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({error:'Unauthorized'},{status:401});
    await runEncryptedWorkflows(user.userId);
    const events = await financialRead(async (db, key) => {
      const events = await db`
      with today as (
        select w.*, (now() at time zone (schedule->>'timeZone'))::date as local_day
        from workflows w where user_id=${user.userId} and schedule->>'enabled'='true'
      ), scheduled as (
        select *, (local_day+(schedule->>'time')::time) at time zone (schedule->>'timeZone') as due
        from today where schedule->'days' @> to_jsonb(extract(dow from local_day)::integer)
      )
      select s.id as "workflowId", t.id as "transactionId", s.schedule->>'timeZone' as "timeZone",
        s.local_day::text as "localDate", coalesce(o.scheduled_at,s.due) as "scheduledAt",
        coalesce(o.status,'upcoming') as status
      from scheduled s left join workflow_occurrences o on o.workflow_id=s.id and o.local_date=s.local_day
      left join transactions t on t.id=o.transaction_id and t.user_id=s.user_id
      where s.due > s.schedule_started_at
        and (s.due at time zone (s.schedule->>'timeZone'))::time=(s.schedule->>'time')::time
      order by s.due,s.id
    `;
      const workflowIds = [...new Set(events.map((event) => event.workflowId))];
      const transactionIds = [...new Set(events.flatMap((event) => event.transactionId ? [event.transactionId] : []))];
      const workflows = await hydrate(db, key, "workflows", user.userId,
        await db<WorkflowRow[]>`select * from workflows where user_id = ${user.userId} and id = any(${workflowIds}::uuid[])`);
      const transactions = await hydrate(db, key, "transactions", user.userId,
        await db<TransactionRow[]>`select * from transactions where user_id = ${user.userId} and id = any(${transactionIds}::uuid[])`);
      const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow]));
      const transactionById = new Map(transactions.map((entry) => [entry.id, entry]));
      return events.map(({ transactionId, ...event }) => {
        const workflow = workflowById.get(event.workflowId);
        if (!workflow) throw new Error("Scheduled workflow unavailable");
        const entry = transactionById.get(transactionId);
        return { ...event, name: workflow.name, amount: entry?.amount ?? workflow.amount, type: entry?.type ?? workflow.type };
      });
    });
    return NextResponse.json({events}, {headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    console.error('[Workflow events GET]', error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({error:'Could not load scheduled workflows'},{status:500});
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({error:'Unauthorized'},{status:401});
    const body = await req.json();
    if (typeof body.workflowId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.workflowId) || body.action !== 'skip' || typeof body.localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.localDate)) {
      return NextResponse.json({error:'Invalid event action'},{status:400});
    }
    if (!Number.isFinite(Date.parse(`${body.localDate}T00:00:00Z`)) || new Date(`${body.localDate}T00:00:00Z`).toISOString().slice(0,10) !== body.localDate) {
      return NextResponse.json({error:'Invalid event date'},{status:400});
    }
    const result = await financialWrite(user.userId, async (tx, key) => {
      // Same workflow lock as the worker: skip/undo and an automatic entry
      // cannot race into two conflicting outcomes.
      const [wf] = await tx`select id, schedule, schedule_started_at::text as started_at_text from workflows where id=${body.workflowId} and user_id=${user.userId} for update`;
      if (!wf?.schedule?.enabled) return false;
      const [event] = await tx`
        select ${body.localDate}::date::text as day,
          ${body.localDate}::date <= (now() at time zone (${wf.schedule.timeZone}))::date as allowed,
          ((${body.localDate}::date + ${wf.schedule.time}::time) at time zone ${wf.schedule.timeZone})::text as due,
          extract(dow from ${body.localDate}::date)::integer as weekday
      `;
      // Bind strings as text to preserve sub-millisecond database boundaries.
      const [valid] = await tx`select ${event.due}::text::timestamptz > ${wf.started_at_text}::text::timestamptz as ok`;
      if (!event.allowed || !valid.ok || !wf.schedule.days.includes(event.weekday)) return false;
      const [existing] = await tx`
        insert into workflow_occurrences(user_id,workflow_id,local_date,scheduled_at,status)
        values(${user.userId},${wf.id},${event.day}::date,${event.due}::text::timestamptz,'skipped')
        on conflict(workflow_id,local_date) do update set status='skipped'
        returning transaction_id
      `;
      if (existing.transaction_id) {
        await tx`update transactions set deleted_at=coalesce(deleted_at,now()) where id=${existing.transaction_id} and user_id=${user.userId}`;
        await refreshEncryptedBalances(tx, key, user.userId);
      }
      return true;
    });
    if (!result) return NextResponse.json({error:'No scheduled event for today'},{status:409});
    return NextResponse.json({ok:true});
  } catch(error) {
    console.error('[Workflow events POST]', error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({error:'Could not skip this occurrence'},{status:500});
  }
}
