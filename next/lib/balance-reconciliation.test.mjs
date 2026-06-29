import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getBalanceReconciliationStats,
  sortBalanceReconciliationHistory,
} from "./balance-reconciliation.js";

const alerts = [
  {
    _id: "older-kept",
    expectedBalance: 1200,
    bankBalance: 1180,
    difference: -20,
    status: "kept",
    createdAt: "2026-06-25T08:00:00.000Z",
  },
  {
    _id: "latest-pending",
    expectedBalance: 400,
    bankBalance: 455.5,
    difference: 55.5,
    status: "pending",
    createdAt: "2026-06-27T08:00:00.000Z",
  },
  {
    _id: "middle-applied",
    expectedBalance: 800,
    bankBalance: 810,
    difference: 10,
    status: "applied",
    createdAt: "2026-06-26T08:00:00.000Z",
  },
];

test("sorts balance reconciliation history newest first", () => {
  assert.deepEqual(
    sortBalanceReconciliationHistory(alerts).map((alert) => alert._id),
    ["latest-pending", "middle-applied", "older-kept"]
  );
});

test("summarizes balance reconciliation history counts and differences", () => {
  assert.deepEqual(getBalanceReconciliationStats(alerts), {
    totalCount: 3,
    pendingCount: 1,
    appliedCount: 1,
    keptCount: 1,
    totalAbsoluteDifference: 85.5,
    latestDifference: 55.5,
    latestCreatedAt: "2026-06-27T08:00:00.000Z",
  });
});
