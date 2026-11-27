import { getFinancialRecord, recordFields, storeFinancialRows } from "./financial-records.mjs";

async function walkFinancialRecords(sql, pageSize, handleBatch) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new Error("Financial encryption page size must be between 1 and 500");
  }

  const counts = {};
  for (const kind of Object.keys(recordFields)) {
    const key = kind === "balances" ? "payment_method" : "id";
    let cursor = { owner_id: "00000000-0000-0000-0000-000000000000", record_id: "" };
    let rows;
    let count = 0;

    do {
      rows = await sql.begin(async (tx) => {
        const batch = await tx`
          select user_id::text as owner_id, ${tx(key)}::text as record_id, to_jsonb(financial_row.*) as financial_data
          from public.${tx(kind)} financial_row
          where (user_id, ${tx(key)}::text) > (${cursor.owner_id}::uuid, ${cursor.record_id}::text)
          order by user_id, ${tx(key)}::text
          limit ${pageSize}
          for share of financial_row
        `;
        if (batch.length === 0) return batch;

        await handleBatch(tx, kind, batch);
        return batch;
      });
      if (rows.length > 0) cursor = rows.at(-1);
      count += rows.length;
    } while (rows.length === pageSize);

    counts[kind] = count;
  }
  return counts;
}

export function backfillFinancialEncryption(sql, cipher, { pageSize = 100 } = {}) {
  return walkFinancialRecords(sql, pageSize, (tx, kind, batch) =>
    storeFinancialRows(tx, cipher, kind, batch.map((row) => row.financial_data)));

}

export function verifyFinancialEncryptionBackfill(sql, cipher, { pageSize = 100 } = {}) {
  return walkFinancialRecords(sql, pageSize, async (tx, kind, batch) => {
    const owners = [...new Set(batch.map((row) => row.owner_id))];
    const ids = [...new Set(batch.map((row) => row.record_id))];
    const mirrored = await tx`
      select owner_id::text, record_id, envelope
      from expenser_private.financial_payloads
      where record_kind = ${kind} and owner_id in ${tx(owners)} and record_id in ${tx(ids)}
    `;
    const byId = new Map(mirrored.map((row) => [JSON.stringify([row.owner_id, row.record_id]), row.envelope]));
    for (const row of batch) {
      const { record, fields } = getFinancialRecord(kind, row);
      const envelope = byId.get(JSON.stringify([row.owner_id, row.record_id]));
      if (!envelope) throw new Error(`Financial backfill is missing a ${kind} payload`);
      if (JSON.stringify(cipher.open(record, envelope)) !== JSON.stringify(fields)) {
        throw new Error(`Financial backfill does not match a ${kind} source row`);
      }
    }
  });
}
