export type TransactionReviewStatus = "pending" | "complete";

export function deriveTransactionReviewState(value: {
  description?: unknown;
  category?: unknown;
  importSource?: string | null;
  importSourceKey?: string | null;
}): {
  description: string;
  category: string;
  reviewStatus: TransactionReviewStatus;
};

export function getTransactionDisplayFields(value: {
  description?: string | null;
  category?: string | null;
  reviewStatus?: TransactionReviewStatus | null;
}): {
  description: string;
  category: string;
};
