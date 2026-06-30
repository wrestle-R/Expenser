import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBearerToken } from "./auth-token.mjs";

describe("getBearerToken", () => {
  it("returns the token from a valid bearer header", () => {
    assert.equal(getBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
  });

  it("ignores missing, malformed, or blank authorization headers", () => {
    assert.equal(getBearerToken(null), null);
    assert.equal(getBearerToken(""), null);
    assert.equal(getBearerToken("Basic abc"), null);
    assert.equal(getBearerToken("Bearer   "), null);
  });
});
