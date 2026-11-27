const paymentMethods = ["bank", "cash", "splitwise"];

export function roundMoney(value) {
  if (!Number.isFinite(value)) throw new Error("Invalid balance calculation");
  const [coefficient, exponent = "0"] = Math.abs(value).toPrecision(15).split("e");
  const [integer, fraction = ""] = coefficient.split(".");
  const units = BigInt(integer + fraction);
  const scale = Number(exponent) - fraction.length + 2;

  let cents;
  if (scale >= 0) {
    cents = units * 10n ** BigInt(scale);
  } else {
    const divisor = 10n ** BigInt(-scale);
    cents = units / divisor + (units % divisor * 2n >= divisor ? 1n : 0n);
  }
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Balance is outside the supported range");
  return Math.sign(value) * Number(cents) / 100;
}

function readEncryptedRow(cipher, ownerId, kind, row) {
  if (!row?.envelope) throw new Error(`Missing encrypted ${kind} record`);
  return cipher.open({ ownerId, kind, recordId: row.record_id }, row.envelope);
}

// Dates and the balance opening timestamps are queryable metadata. Monetary
// values are authenticated and calculated in the application process.
export async function calculateEncryptedBalanceSnapshot(tx, cipher, ownerId) {
  const accounts = await tx`
    select balance.payment_method as record_id, encrypted.envelope
    from public.balances balance
    left join expenser_private.financial_payloads encrypted on
      encrypted.record_kind = 'balances' and
      encrypted.owner_id = balance.user_id and encrypted.record_id = balance.payment_method
    where balance.user_id = ${ownerId}
  `;
  const rows = await tx`
    select entry.id::text as record_id, encrypted.envelope,
      array(
        select balance.payment_method from public.balances balance
        where balance.user_id = entry.user_id and entry.date > balance.opening_at
      ) as methods_after_opening
    from public.transactions entry
    left join expenser_private.financial_payloads encrypted on
      encrypted.record_kind = 'transactions' and
      encrypted.owner_id = entry.user_id and encrypted.record_id = entry.id::text
    where entry.user_id = ${ownerId} and entry.deleted_at is null
      and entry.date > (select min(opening_at) from public.balances where user_id = ${ownerId})
    order by entry.date, entry.id
  `;

  const accountByMethod = new Map(accounts.map((account) => [account.record_id, account]));
  const starts = Object.fromEntries(paymentMethods.map((method) => {
    const { opening_balance } = readEncryptedRow(cipher, ownerId, "balances", accountByMethod.get(method));
    return [method, Number(opening_balance)];
  }));
  const totals = { bank: 0, cash: 0, splitwise: 0 };
  let linkedExpenses = 0;
  for (const row of rows) {
    const entry = readEncryptedRow(cipher, ownerId, "transactions", row);
    if (row.methods_after_opening.includes(entry.payment_method)) {
      const signedAmount = (entry.type === "income" ? 1 : -1) * Number(entry.amount);
      totals[entry.payment_method] += signedAmount;
    }
    if (entry.type === "expense" && row.methods_after_opening.includes("splitwise")) {
      linkedExpenses += Number(entry.split_amount);
    }
  }
  return {
    bank: roundMoney(starts.bank + totals.bank),
    cash: roundMoney(starts.cash + totals.cash),
    splitwise: roundMoney(starts.splitwise + totals.splitwise + linkedExpenses),
  };
}
