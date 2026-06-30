import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getAuthErrorMessage,
  validateSignUpForm,
} from "./auth-form.js";

test("rejects sign up when passwords do not match", () => {
  assert.equal(
    validateSignUpForm({
      name: "Russel Daniel Paul",
      email: "russeldanielpaul@gmail.com",
      password: "Password123!",
      confirmPassword: "Password123",
    }),
    "Passwords do not match."
  );
});

test("accepts sign up when required fields are present and passwords match", () => {
  assert.equal(
    validateSignUpForm({
      name: "Russel Daniel Paul",
      email: "russeldanielpaul@gmail.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    }),
    null
  );
});

test("maps invalid api key auth errors to a clearer message", () => {
  assert.equal(
    getAuthErrorMessage("Invalid API key"),
    "Authentication is misconfigured. Restart the Next app after updating the Supabase public key."
  );
});

test("keeps normal auth errors unchanged", () => {
  assert.equal(
    getAuthErrorMessage("Invalid login credentials"),
    "Invalid login credentials"
  );
});
