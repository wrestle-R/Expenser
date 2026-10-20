import assert from "node:assert/strict";
import { test } from "node:test";

import { toIsoString, toRequiredIsoString } from "./iso-date.js";

test("normalizes valid date values to ISO strings", () => {
  assert.equal(toIsoString("2026-08-06T08:05:12.453Z"), "2026-08-06T08:05:12.453Z");
});

test("returns null for missing or invalid optional dates", () => {
  assert.equal(toIsoString(null), null);
  assert.equal(toIsoString("not-a-date"), null);
  assert.equal(toIsoString("infinity"), null);
});

test("returns a valid ISO fallback for required dates", () => {
  assert.equal(toRequiredIsoString("not-a-date"), "1970-01-01T00:00:00.000Z");
});
