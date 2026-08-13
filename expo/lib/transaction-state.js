function transactionKey(transaction) {
  return transaction.importSourceKey || transaction.clientRequestId || transaction._id;
}

function transactionTime(transaction) {
  const time = new Date(transaction.date).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function dedupeTransactions(items) {
  const deduped = new Map();
  for (const item of items) {
    if (item.deletedAt) continue;
    deduped.set(transactionKey(item), item);
  }
  return [...deduped.values()].sort(
    (left, right) => transactionTime(right) - transactionTime(left)
  );
}

export function optimisticAddTransaction(items, transaction) {
  return dedupeTransactions([transaction, ...items]);
}

export function optimisticUpdateTransaction(items, id, patch) {
  return dedupeTransactions(
    items.map((item) => (item._id === id ? { ...item, ...patch } : item))
  );
}

export function optimisticDeleteTransaction(items, id) {
  return items.filter((item) => item._id !== id);
}

export function mergeServerTransactions({
  localTransactions,
  serverTransactions,
  operations,
}) {
  const pendingIds = new Set(
    operations
      .filter((item) => item.entity === "transaction")
      .map((item) => item.entityId)
  );
  const deletedIds = new Set(
    operations
      .filter(
        (item) => item.entity === "transaction" && item.action === "delete"
      )
      .map((item) => item.entityId)
  );
  const pendingLocal = localTransactions.filter((item) =>
    pendingIds.has(item._id)
  );

  return dedupeTransactions([
    ...pendingLocal,
    ...serverTransactions.filter(
      (item) =>
        !deletedIds.has(item._id) &&
        !pendingIds.has(item._id) &&
        !pendingIds.has(item.clientRequestId)
    ),
  ]);
}
