function toTime(value) {
  const time = new Date(value ?? 0).getTime();
  return Number.isFinite(time) ? time : 0;
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
