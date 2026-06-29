function sortBalanceReconciliationHistory(alerts) {
  return [...alerts].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

function getBalanceReconciliationStats(alerts) {
  const history = sortBalanceReconciliationHistory(alerts);

  return {
    totalCount: history.length,
    pendingCount: history.filter((alert) => alert.status === "pending").length,
    appliedCount: history.filter((alert) => alert.status === "applied").length,
    keptCount: history.filter((alert) => alert.status === "kept").length,
    totalAbsoluteDifference: Number(
      history
        .reduce((sum, alert) => sum + Math.abs(Number(alert.difference)), 0)
        .toFixed(2)
    ),
    latestDifference: history[0] ? Number(history[0].difference) : 0,
    latestCreatedAt: history[0]?.createdAt ?? null,
  };
}

exports.sortBalanceReconciliationHistory = sortBalanceReconciliationHistory;
exports.getBalanceReconciliationStats = getBalanceReconciliationStats;
