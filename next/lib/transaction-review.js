function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isImportedTransaction(value) {
  return Boolean(value.importSource && value.importSourceKey);
}

export function deriveTransactionReviewState(value) {
  const description = trimText(value.description);
  const category = trimText(value.category);

  if (!isImportedTransaction(value)) {
    return {
      description: description || "No description",
      category: category || "General",
      reviewStatus: "complete",
    };
  }

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
    return {
      description: trimText(value.description) || "Pending details",
      category: trimText(value.category) || "Pending category",
    };
  }

  return {
    description: trimText(value.description) || "No description",
    category: trimText(value.category) || "General",
  };
}
