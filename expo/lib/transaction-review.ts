import type { CreateTransactionPayload, ITransaction } from "./types";

function isImportedPayload(payload: Pick<CreateTransactionPayload, "importSource" | "importSourceKey">) {
  return Boolean(payload.importSource && payload.importSourceKey);
}

const IMPORTED_FALLBACK_CATEGORY = "bank import";

export function getPendingReviewStatus(
  payload: Pick<CreateTransactionPayload, "description" | "category" | "importSource" | "importSourceKey">
) {
  if (!isImportedPayload(payload)) {
    return "active" as const;
  }

  const category = payload.category.trim().toLowerCase();
  if (!category || category === IMPORTED_FALLBACK_CATEGORY) {
    return "needs_category" as const;
  }

  return "active" as const;
}

export function getTransactionDisplayFields(
  transaction: Pick<ITransaction, "description" | "category" | "reviewStatus">
) {
  if (transaction.reviewStatus === "needs_category") {
    const category = transaction.category.trim();

    return {
      description: transaction.description.trim() || "Bank transaction",
      category: category === IMPORTED_FALLBACK_CATEGORY ? "" : category,
    };
  }

  return {
    description: transaction.description.trim() || "No description",
    category: transaction.category.trim() || "General",
  };
}

export function getPendingReviewUpdate(value: {
  description?: string | null;
  category?: string | null;
}) {
  return {
    description: value.description?.trim() ?? "",
    category: value.category?.trim() ?? "",
  };
}
