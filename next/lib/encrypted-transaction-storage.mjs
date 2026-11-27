import { calculateEncryptedBalanceSnapshot, roundMoney } from "./encrypted-balance-snapshot.mjs";
import { hydrateFinancialRows, lockFinancialOwner, storeFinancialRows } from "./financial-records.mjs";

export async function ensureEncryptedBalances(tx, cipher, ownerId) {
  const created = await tx`
    insert into public.balances (user_id, payment_method)
    values (${ownerId}, 'bank'), (${ownerId}, 'cash'), (${ownerId}, 'splitwise')
    on conflict (user_id, payment_method) do nothing returning *
  `;
  await storeFinancialRows(tx, cipher, "balances", created);
}

export async function readEncryptedBalances(tx, cipher, ownerId) {
  const rows = await tx`select * from public.balances where user_id = ${ownerId} order by payment_method`;
  return hydrateFinancialRows(tx, cipher, "balances", ownerId, rows);
}

export async function rebaseEncryptedBalance(tx, cipher, ownerId, method, amount, at = null) {
  const [row] = await tx`
    update public.balances set opening_at = coalesce(${at}::text::timestamptz, now())
    where user_id = ${ownerId} and payment_method = ${method} returning *
  `;
  if (!row) throw new Error("Balance account unavailable");
  const rounded = roundMoney(amount);
  await storeFinancialRows(tx, cipher, "balances", [{ ...row, opening_balance: rounded, current_balance: rounded }]);
}

export async function refreshEncryptedBalances(tx, cipher, ownerId) {
  const balances = await calculateEncryptedBalanceSnapshot(tx, cipher, ownerId);
  const rows = await readEncryptedBalances(tx, cipher, ownerId);
  await storeFinancialRows(tx, cipher, "balances", rows.map((row) => ({
    ...row, current_balance: balances[row.payment_method],
  })));
}

export async function insertEncryptedTransaction(tx, cipher, {
  ownerId, transactionId, date, reviewStatus = "active", exchangeExpenseId = null, fields,
}) {
  await lockFinancialOwner(tx, ownerId);
  await ensureEncryptedBalances(tx, cipher, ownerId);
  const [row] = await tx`
    insert into public.transactions (id, user_id, date, type, payment_method, review_status, exchange_expense_id)
    values (${transactionId}, ${ownerId}, ${date}, 'expense', 'bank', ${reviewStatus}, ${exchangeExpenseId}) returning *
  `;
  const merged = { ...row, ...fields };
  await storeFinancialRows(tx, cipher, "transactions", [merged]);
  await refreshEncryptedBalances(tx, cipher, ownerId);
  return merged;
}
