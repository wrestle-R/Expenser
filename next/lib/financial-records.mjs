export const recordFields = {
  transactions: [
    "amount", "split_amount", "description", "category", "payment_method", "type",
    "imported_bank_balance", "imported_bank_reference", "imported_account_suffix",
    "import_source", "import_source_key", "imported_bank_confidence", "client_request_id",
  ],
  balances: ["opening_balance", "current_balance"],
  balance_reconciliation_alerts: ["bank_balance", "expected_balance", "difference", "source"],
  user_categories: ["name", "color"],
  workflows: ["name", "description", "category", "payment_method", "amount", "split_amount", "type", "client_request_id"],
  users: ["name", "occupation"],
};

export function getFinancialRecord(kind, row) {
  const record = { kind, ownerId: row.owner_id, recordId: row.record_id };
  const data = row.financial_data;
  const fields = Object.fromEntries(recordFields[kind].map((field) => [field, data[field]]));
  return { record, fields };
}

export function sealFinancialRow(cipher, kind, data, recordId = data.id) {
  const { record, fields } = getFinancialRecord(kind, { owner_id: data.user_id, record_id: recordId, financial_data: data });
  const lookup = (purpose, value) => value ? cipher.lookup(record.ownerId, purpose, value) : null;
  const envelope = cipher.seal(record, fields);

  return {
    record_kind: kind,
    owner_id: record.ownerId,
    record_id: record.recordId,
    envelope,
    payload_fingerprint: lookup("backfill:" + kind, JSON.stringify([record.recordId, fields])),
    import_lookup: lookup("transaction-import", data.import_source_key),
    bank_reference_lookup: data.imported_account_suffix && data.imported_bank_reference
      ? lookup("bank-reference", JSON.stringify([data.imported_account_suffix, data.imported_bank_reference]))
      : null,
    request_lookup: lookup(kind + "-request", data.client_request_id),
    category_lookup: kind === "user_categories"
      ? lookup("category-name:" + data.type, data.name.toLowerCase())
      : null,
  };
}

export async function storeFinancialRows(tx, cipher, kind, rows) {
  if (!rows.length) return;
  const payloads = rows.map((row) => {
    const payload = sealFinancialRow(cipher, kind, row, kind === "balances" ? row.payment_method : row.id);
    return { ...payload, envelope: tx.json(payload.envelope) };
  });
  await tx`
    insert into expenser_private.financial_payloads ${tx(payloads)}
    on conflict (record_kind, owner_id, record_id) do update set
      envelope = excluded.envelope,
      payload_fingerprint = excluded.payload_fingerprint,
      import_lookup = excluded.import_lookup,
      bank_reference_lookup = excluded.bank_reference_lookup,
      request_lookup = excluded.request_lookup,
      category_lookup = excluded.category_lookup
    where financial_payloads.payload_fingerprint is distinct from excluded.payload_fingerprint
       or financial_payloads.envelope->>'keyId' is distinct from excluded.envelope->>'keyId'
  `;
}

export async function hydrateFinancialRows(tx, cipher, kind, ownerId, rows) {
  if (!rows.length) return [];
  const ids = rows.map((row) => kind === "balances" ? row.payment_method : row.id);
  const payloads = await tx`
    select record_id, envelope from expenser_private.financial_payloads
    where record_kind = ${kind} and owner_id = ${ownerId} and record_id = any(${ids}::text[])
  `;
  const byId = new Map(payloads.map((row) => [row.record_id, row.envelope]));
  return rows.map((row, index) => {
    const recordId = ids[index];
    const envelope = byId.get(recordId);
    if (!envelope || row.user_id !== ownerId) throw new Error("Encrypted financial record unavailable");
    const fields = cipher.open({ kind, ownerId, recordId }, envelope);
    return { ...row, ...fields };
  });
}

export async function lockFinancialOwner(tx, ownerId) {
  await tx`select pg_advisory_xact_lock(hashtextextended(${ownerId}, 6517))`;
}

export async function deleteFinancialRow(tx, kind, ownerId, id) {
  await tx`delete from expenser_private.financial_payloads where record_kind = ${kind} and owner_id = ${ownerId} and record_id = ${id}`;
}

export async function assertEncryptedStorageReady(tx) {
  const [state] = await tx`
    select exists (
      select 1 from pg_constraint where conrelid = 'public.transactions'::regclass
        and conname = 'transactions_encrypted_fields'
    ) as ready
  `;
  if (!state.ready) throw new Error("Financial storage is being upgraded");
}

export async function markEncryptedWriter(tx) {
  await tx`select set_config('expenser.encrypted_writer', 'yes', true)`;
}
