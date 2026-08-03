import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPendingReviewUpdateFields,
  deriveTransactionReviewState,
  getPendingReviewUpdate,
  getTransactionDisplayFields,
} from "./transaction-review.js";

test("marks imported transactions with a missing category as needing a category", () => {
  const result = deriveTransactionReviewState({
    description: "",
    category: "",
    importSource: "union_bank_notification",
    importSourceKey: "union-bank:ref:123",
  });

  assert.deepEqual(result, {
    description: "",
    category: "",
    reviewStatus: "needs_category",
  });
});

test("keeps manual transactions active with an optional description", () => {
  const result = deriveTransactionReviewState({
    description: "",
    category: "",
    importSource: null,
    importSourceKey: null,
  });

  assert.deepEqual(result, {
    description: "",
    category: "General",
    reviewStatus: "active",
  });
});

test("marks imported transactions active once a category is filled", () => {
  const result = deriveTransactionReviewState({
    description: "Metro recharge",
    category: "transport",
    importSource: "union_bank_notification",
    importSourceKey: "union-bank:ref:456",
  });

  assert.deepEqual(result, {
    description: "Metro recharge",
    category: "transport",
    reviewStatus: "active",
  });
});

test("does not require an imported transaction description", () => {
  const result = deriveTransactionReviewState({
    description: "",
    category: "transport",
    importSource: "union_bank_notification",
    importSourceKey: "union-bank:ref:789",
  });

  assert.deepEqual(result, {
    description: "",
    category: "transport",
    reviewStatus: "active",
  });
});

test("pending review edits only keep category and optional description", () => {
  assert.deepEqual(
    getPendingReviewUpdate({ category: " transport ", description: " " }),
    { category: "transport", description: "" }
  );
  assert.doesNotThrow(() =>
    assertPendingReviewUpdateFields({ category: "transport", description: "" })
  );
  assert.throws(
    () => assertPendingReviewUpdateFields({ category: "transport", amount: 50 }),
    /only update category and description/
  );
});

test("uses pending display labels without writing placeholders into stored fields", () => {
  const result = getTransactionDisplayFields({
    description: "",
    category: "",
    reviewStatus: "needs_category",
  });

  assert.deepEqual(result, {
    description: "Bank transaction",
    category: "",
  });
});

test("hides the internal bank import placeholder in pending display labels", () => {
  const result = getTransactionDisplayFields({
    description: "Juice",
    category: "bank import",
    reviewStatus: "needs_category",
  });

  assert.deepEqual(result, {
    description: "Juice",
    category: "",
  });
});

test("treats the legacy bank import category as missing", () => {
  const result = deriveTransactionReviewState({
    description: "",
    category: "",
    importSource: "union_bank_notification",
    importSourceKey: "union-bank:fallback:4280:income:5000.00:2026-07-05T09:33:59.000Z:5239.58",
  });

  assert.deepEqual(result, {
    description: "",
    category: "",
    reviewStatus: "needs_category",
  });
});
