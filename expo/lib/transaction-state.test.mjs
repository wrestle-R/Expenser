import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeServerTransactions,
  optimisticAddTransaction,
  optimisticDeleteTransaction,
  optimisticUpdateTransaction,
} from "./transaction-state.js";

const serverTransaction = {
  _id: "server-1",
  clientRequestId: null,
  description: "Older row",
  date: "2026-08-11T10:00:00.000Z",
};
const optimisticTransaction = {
  _id: "temp-1",
  clientRequestId: "temp-1",
  description: "Salary",
  date: "2026-08-12T15:42:41.000Z",
};

test("optimistic add is immediate and deduplicated", () => {
  const next = optimisticAddTransaction(
    [serverTransaction],
    optimisticTransaction
  );
  assert.deepEqual(next.map((item) => item._id), ["temp-1", "server-1"]);
  assert.equal(
    optimisticAddTransaction(next, optimisticTransaction).length,
    2
  );
});

test("optimistic update and delete use the latest array", () => {
  const updated = optimisticUpdateTransaction(
    [serverTransaction, optimisticTransaction],
    "server-1",
    { description: "Updated" }
  );
  assert.equal(updated.find((item) => item._id === "server-1")?.description, "Updated");
  assert.deepEqual(
    optimisticDeleteTransaction(updated, "temp-1").map((item) => item._id),
    ["server-1"]
  );
});

test("stale server data cannot replace a transaction with a pending outbox operation", () => {
  const merged = mergeServerTransactions({
    localTransactions: [serverTransaction, optimisticTransaction],
    serverTransactions: [serverTransaction],
    operations: [
      { entity: "transaction", entityId: "temp-1", action: "create" },
    ],
  });

  assert.deepEqual(merged.map((item) => item._id), ["temp-1", "server-1"]);
});

test("pending deletes stay absent when merging server data", () => {
  const merged = mergeServerTransactions({
    localTransactions: [],
    serverTransactions: [serverTransaction],
    operations: [
      { entity: "transaction", entityId: "server-1", action: "delete" },
    ],
  });

  assert.deepEqual(merged, []);
});
