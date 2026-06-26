import type { Transaction, TransactionPayload } from "./types";

export function getPendingReviewStatus(
  payload: Pick<TransactionPayload, "description" | "category" | "importSource" | "importSourceKey">
) {
  if (!(payload.importSource && payload.importSourceKey)) {
    return "complete" as const;
  }

  if (!payload.description.trim() || !payload.category.trim()) {
    return "pending" as const;
  }

  return "complete" as const;
}

export function getTransactionDisplayFields(
  transaction: Pick<Transaction, "description" | "category" | "reviewStatus">
) {
  if (transaction.reviewStatus === "pending") {
    return {
      description: transaction.description.trim() || "Pending details",
      category: transaction.category.trim() || "Pending category",
    };
  }

  return {
    description: transaction.description.trim() || "No description",
    category: transaction.category.trim() || "General",
  };
}
