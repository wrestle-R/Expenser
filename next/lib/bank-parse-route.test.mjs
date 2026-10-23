import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import * as parser from "./bank-import-parser.js";
const require = createRequire(import.meta.url);
const ts = require("typescript");
function harness({ completion, authorized = true, configured = true } = {}) {
  let calls = 0;
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL("../app/api/bank-imports/parse/route.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(source, {
    exports, require: (name) => {
      if (name === "next/server") return { NextResponse: { json: (value, init) => Response.json(value, init) } };
      if (name === "@/lib/auth") return { getAuthenticatedUser: async () => authorized ? { id: "synthetic-test" } : null };
      if (name === "@/lib/bank-import-parser") return parser;
      throw new Error(`Unexpected import ${name}`);
    },
    process: { env: configured ? { GROQ_API_KEY: "synthetic-test-key" } : {} },
    console: { info() {}, error() {} }, setTimeout, clearTimeout, AbortController,
    fetch: async () => {
      calls++;
      return Response.json({ choices: [{ message: { content: JSON.stringify(completion) } }] });
    },
  });
  return { post: exports.POST, calls: () => calls };
}
const envelope = { message: "UPI payment INR 321.00 is done from your account ending 1234.", sender: "VM-HDFCBK", sourceKey: "synthetic", sourcePackage: "sms.test", capturedAt: "2026-10-23T12:00:00.000Z" };
const request = (body) => new Request("https://api.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("local transactions and exclusions bypass the cloud even without its credentials", async () => {
  const { post, calls } = harness({ configured: false });
  for (const [message, kind] of [["Rs 100 debited from A/c XX1234", "transaction"], ["OTP is 123456 for INR 500 payment", "non_transaction"]]) {
    const response = await post(request({ ...envelope, message }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.kind, kind);
    assert.equal(body.parser, "regex");
  }
  assert.equal(calls(), 0);
});

test("only unresolved formats invoke cloud and normalize a grounded structured transaction", async () => {
  const { post, calls } = harness({ completion: { kind: "transaction", parsed: { type: "expense", currency: "INR", amount: 321, confidence: "medium", bankName: "HDFC Bank", accountSuffix: "1234" } } });
  const response = await post(request(envelope));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.kind, "transaction");
  assert.equal(body.parser, "groq");
  assert.equal(body.parsed.amount, 321);
  assert.equal(body.parsed.occurredAt, envelope.capturedAt);
  assert.equal(calls(), 1);
});

test("cloud guesses, low confidence, and unsupported currencies remain reviewable instead of imported", async () => {
  for (const patch of [{ amount: 999 }, { confidence: "low" }, { currency: "USD" }]) {
    const { post } = harness({ completion: { kind: "transaction", parsed: { type: "expense", currency: "INR", amount: 321, confidence: "medium", ...patch } } });
    const response = await post(request(envelope));
    assert.equal((await response.json()).kind, "unparsed");
  }
});

test("requires authentication and rejects malformed envelopes without calling cloud", async () => {
  assert.equal((await harness({ authorized: false }).post(request(envelope))).status, 401);
  const { post, calls } = harness();
  for (const body of [null, [], {}, { ...envelope, capturedAt: "invalid" }, { ...envelope, message: "x".repeat(4001) }]) {
    assert.equal((await post(request(body))).status, 400);
  }
  assert.equal(calls(), 0);
});
