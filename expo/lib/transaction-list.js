// Build once per snapshot, rather than lowercasing and parsing dates on every keystroke.
export function indexTransactions(transactions) {
  return transactions.map((transaction) => ({
    transaction,
    search: [transaction.description, transaction.category, transaction.paymentMethod, transaction.amount, transaction.importedBankReference, transaction.importedAccountSuffix].filter((v) => v != null).join(" ").normalize("NFKC").toLowerCase(),
  }));
}
export function searchTransactions(index, query) {
  const words = String(query ?? "").normalize("NFKC").toLowerCase().trim().split(/\s+/).filter(Boolean);
  return index.filter((entry) => words.every((word) => entry.search.includes(word))).map((entry) => entry.transaction);
}
