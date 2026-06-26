import type { CreateTransactionPayload, ITransaction } from "./types";

function isImportedPayload(payload: Pick<CreateTransactionPayload, "importSource" | "importSourceKey">) {
  return Boolean(payload.importSource && payload.importSourceKey);
}

export function getPendingReviewStatus(
  payload: Pick<CreateTransactionPayload, "description" | "category" | "importSource" | "importSourceKey">
) {
  if (!isImportedPayload(payload)) {
    return "complete" as const;
  }

  if (!payload.description.trim() || !payload.category.trim()) {
    return "pending" as const;
  }

  return "complete" as const;
}

export function getTransactionDisplayFields(
  transaction: Pick<ITransaction, "description" | "category" | "reviewStatus">
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
