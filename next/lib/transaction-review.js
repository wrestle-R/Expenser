function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isImportedTransaction(value) {
  return Boolean(value.importSource && value.importSourceKey);
}

const IMPORTED_FALLBACK_CATEGORY = "bank import";

export function deriveTransactionReviewState(value) {
  const description = trimText(value.description);
  const rawCategory = trimText(value.category);

  if (!isImportedTransaction(value)) {
    return {
      description: description || "No description",
      category: rawCategory || "General",
      reviewStatus: "complete",
    };
  }

  const category = rawCategory || IMPORTED_FALLBACK_CATEGORY;

  if (!description || !category) {
    return {
      description,
      category,
      reviewStatus: "pending",
    };
  }

  return {
    description,
    category,
    reviewStatus: "complete",
  };
}

export function getTransactionDisplayFields(value) {
  if (value.reviewStatus === "pending") {
    const category = trimText(value.category);

    return {
      description: trimText(value.description) || "Pending details",
      category: category === IMPORTED_FALLBACK_CATEGORY ? "Bank import" : category,
    };
  }

  return {
    description: trimText(value.description) || "No description",
    category: trimText(value.category) || "General",
  };
}
