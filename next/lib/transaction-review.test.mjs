import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveTransactionReviewState,
  getTransactionDisplayFields,
} from "./transaction-review.js";

test("marks imported transactions with missing description/category as pending review", () => {
  const result = deriveTransactionReviewState({
    description: "",
    category: "",
    importSource: "union_bank_notification",
    importSourceKey: "union-bank:ref:123",
  });

  assert.deepEqual(result, {
    description: "",
    category: "",
    reviewStatus: "pending",
  });
});

test("keeps manual transactions complete with existing fallback behavior", () => {
  const result = deriveTransactionReviewState({
    description: "",
    category: "",
    importSource: null,
    importSourceKey: null,
  });

  assert.deepEqual(result, {
    description: "No description",
    category: "General",
    reviewStatus: "complete",
  });
});

test("marks imported transactions complete once both fields are filled", () => {
  const result = deriveTransactionReviewState({
    description: "Metro recharge",
    category: "transport",
    importSource: "union_bank_notification",
    importSourceKey: "union-bank:ref:456",
  });

  assert.deepEqual(result, {
    description: "Metro recharge",
    category: "transport",
    reviewStatus: "complete",
  });
});

test("uses pending display labels without writing placeholders into stored fields", () => {
  const result = getTransactionDisplayFields({
    description: "",
    category: "",
    reviewStatus: "pending",
  });

  assert.deepEqual(result, {
    description: "Pending details",
    category: "Pending category",
  });
});
