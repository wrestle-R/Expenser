import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getApiErrorResponse,
  isDatabaseConnectionError,
} from "./api-errors.js";

test("detects DNS and Supabase pooler database connection errors", () => {
  assert.equal(
    isDatabaseConnectionError(
      new Error("getaddrinfo ENOTFOUND tenant/user postgres.example not found")
    ),
    true
  );
  assert.equal(
    isDatabaseConnectionError({ code: "ENOTFOUND", message: "db not found" }),
    true
  );
  assert.equal(
    isDatabaseConnectionError(new Error("Category name is required")),
    false
  );
});

test("returns a retryable safe response for database connection failures", () => {
  assert.deepEqual(
    getApiErrorResponse(
      new Error("tenant/user postgres.gyecojxcdmjulwtfuuoz not found"),
      "Invalid transaction payload"
    ),
    {
      body: { error: "Service temporarily unavailable. Please try syncing again." },
      status: 503,
    }
  );
});

test("returns validation text for normal user input errors", () => {
  assert.deepEqual(
    getApiErrorResponse(new Error("Category name is required"), "Invalid category"),
    {
      body: { error: "Category name is required" },
      status: 400,
    }
  );
});
