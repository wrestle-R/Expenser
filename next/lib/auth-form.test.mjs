import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getAuthErrorMessage,
  isAuthRateLimitError,
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
    "Sign-in is unavailable because the authentication configuration is invalid."
  );
});

test("maps invalid login credentials to a clearer message", () => {
  assert.equal(
    getAuthErrorMessage("Invalid login credentials"),
    "Incorrect email or password."
  );
});

test("maps rate limit error to a clearer message", () => {
  assert.equal(
    getAuthErrorMessage("email rate limit exceeded"),
    "Too many attempts. Please wait a few minutes before trying again."
  );
});

test("detects auth rate limit variants", () => {
  assert.equal(isAuthRateLimitError("Request rate limit reached"), true);
  assert.equal(isAuthRateLimitError("Too many requests"), true);
  assert.equal(isAuthRateLimitError("Invalid login credentials"), false);
});

test("network failures explain recovery without blaming credentials", () => {
  for (const message of ["Network request failed", "Failed to fetch", "fetch failed", "Request timed out"]) {
    assert.match(getAuthErrorMessage(message), /Could not reach the sign-in service/);
  }
});
