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
      description,
      category: rawCategory || "General",
      reviewStatus: "active",
    };
  }

  const category =
    rawCategory.toLowerCase() === IMPORTED_FALLBACK_CATEGORY ? "" : rawCategory;

  if (!category) {
    return {
      description,
      category,
      reviewStatus: "needs_category",
    };
  }

  return {
    description,
    category,
    reviewStatus: "active",
  };
}

const PENDING_REVIEW_EDITABLE_FIELDS = new Set(["category", "description"]);

export function getPendingReviewUpdate(value) {
  return {
    description: trimText(value.description),
    category: trimText(value.category),
  };
}

export function assertPendingReviewUpdateFields(value) {
  const invalidFields = Object.keys(value).filter(
    (field) => !PENDING_REVIEW_EDITABLE_FIELDS.has(field)
  );
  if (invalidFields.length > 0) {
    throw new Error(
      "Pending review transactions can only update category and description"
    );
  }
}

export function getTransactionDisplayFields(value) {
  if (value.reviewStatus === "needs_category") {
    const category = trimText(value.category);

    return {
      description: trimText(value.description) || "Bank transaction",
      category: category === IMPORTED_FALLBACK_CATEGORY ? "" : category,
    };
  }

  const category = trimText(value.category);
  return {
    description: trimText(value.description) || category || "Transaction",
    category: category || "General",
  };
}
