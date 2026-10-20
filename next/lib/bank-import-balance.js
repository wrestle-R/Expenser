function toTime(value) {
  const time = new Date(value ?? 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function roundMoney(value) {
  return Number(Number(value).toFixed(2));
}

export function calculateImportedBalanceMismatch({
  currentBalance,
  type,
  amount,
  reportedBalance,
}) {
  const signedAmount = type === "income" ? Number(amount) : -Number(amount);
  const expectedBalance = roundMoney(Number(currentBalance) + signedAmount);
  const difference = roundMoney(Number(reportedBalance) - expectedBalance);
  return {
    expectedBalance,
    difference,
    shouldAlert: Math.abs(difference) > 0.01,
  };
}

export function getReconciliationOpeningBalance(alert, action) {
  return roundMoney(
    action === "apply" ? alert.bankBalance : alert.expectedBalance
  );
}

export function getLatestImportedBankBalance(transactions) {
  const latest = transactions
    .filter(
      (transaction) =>
        !transaction.deletedAt &&
        !transaction.deleted_at &&
        transaction.importSource &&
        transaction.importedBankBalance != null &&
        Number.isFinite(Number(transaction.importedBankBalance))
    )
    .sort((left, right) => toTime(right.date) - toTime(left.date))[0];

  return latest ? Number(latest.importedBankBalance) : null;
}
