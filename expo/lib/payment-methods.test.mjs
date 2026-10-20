import assert from "node:assert/strict";
import test from "node:test";

import {
  toggleRequiredPaymentMethod,
  withDefaultPaymentMethod,
} from "./payment-methods.js";

test("defaults an empty mobile profile to Bank", () => {
  assert.deepEqual(withDefaultPaymentMethod([]), ["bank"]);
});

test("blocks turning off the final mobile payment method", () => {
  assert.deepEqual(toggleRequiredPaymentMethod(["cash"], "cash"), {
    methods: ["cash"],
    blocked: true,
  });
});

test("allows switching among multiple mobile payment methods", () => {
  assert.deepEqual(
    toggleRequiredPaymentMethod(["bank", "splitwise"], "bank"),
    { methods: ["splitwise"], blocked: false }
  );
});
