import assert from "node:assert/strict";
import test from "node:test";
import { coalesceOutboxOperation } from "./outbox.js";

function operation(action, payload = {}) {
  return {
    version: 2,
    id: "operation-1",
    entity: "transaction",
    entityId: "local-1",
    action,
    payload,
    createdAt: "2026-07-16T00:00:00.000Z",
    attempts: 0,
  };
}

test("coalesces create then edit into one create", () => {
  const result = coalesceOutboxOperation(
    [operation("create", { amount: 10, description: "" })],
    { entity: "transaction", entityId: "local-1", action: "update", payload: { amount: 20 } },
    () => operation("update")
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].action, "create");
  assert.deepEqual(result[0].payload, { amount: 20, description: "" });
});

test("removes create followed by delete", () => {
  const result = coalesceOutboxOperation(
    [operation("create", { amount: 10 })],
    { entity: "transaction", entityId: "local-1", action: "delete" },
    () => operation("delete")
  );
  assert.deepEqual(result, []);
});

test("coalesces repeated edits and edit then delete", () => {
  const edited = coalesceOutboxOperation(
    [operation("update", { amount: 10 })],
    { entity: "transaction", entityId: "local-1", action: "update", payload: { category: "food" } },
    () => operation("update")
  );
  assert.deepEqual(edited[0].payload, { amount: 10, category: "food" });

  const deleted = coalesceOutboxOperation(
    edited,
    { entity: "transaction", entityId: "local-1", action: "delete" },
    () => operation("delete")
  );
  assert.equal(deleted[0].action, "delete");
  assert.deepEqual(deleted[0].payload, {});
});
