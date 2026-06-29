export type BalanceReconciliationStatus = "pending" | "applied" | "kept";

export type BalanceReconciliationHistoryItem = {
  _id: string;
  expectedBalance: number;
  bankBalance: number;
  difference: number;
  status: BalanceReconciliationStatus;
  createdAt: string;
};

export type BalanceReconciliationStats = {
  totalCount: number;
  pendingCount: number;
  appliedCount: number;
  keptCount: number;
  totalAbsoluteDifference: number;
  latestDifference: number;
  latestCreatedAt: string | null;
};

export function sortBalanceReconciliationHistory<
  T extends BalanceReconciliationHistoryItem,
>(alerts: T[]): T[];

export function getBalanceReconciliationStats(
  alerts: BalanceReconciliationHistoryItem[]
): BalanceReconciliationStats;
