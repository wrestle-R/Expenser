import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePaymentMethods,
  requirePaymentMethods,
  toggleRequiredPaymentMethod,
  withDefaultPaymentMethod,
} from "./payment-methods.js";

test("normalizes payment methods and defaults legacy empty profiles to bank", () => {
  assert.deepEqual(parsePaymentMethods(["cash", "cash", "invalid"]), ["cash"]);
  assert.deepEqual(withDefaultPaymentMethod([]), ["bank"]);
});

test("rejects an explicit profile update with no payment methods", () => {
  assert.throws(
    () => requirePaymentMethods([]),
    /At least one payment method must remain enabled/
  );
});

test("never turns off the final payment method", () => {
  assert.deepEqual(toggleRequiredPaymentMethod(["bank"], "bank"), {
    methods: ["bank"],
    blocked: true,
  });
  assert.deepEqual(toggleRequiredPaymentMethod(["bank", "cash"], "cash"), {
    methods: ["bank"],
    blocked: false,
  });
});
