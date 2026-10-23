import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { withRequestDeadline } from "./request-deadline.js";
import * as localParser from "./local-bank-parser.js";
const require = createRequire(import.meta.url);
const ts = require("typescript");
function harness(respond) {
  let calls = 0;
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL("./api.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(source, {
    exports, require: (name) => {
      if (name === "./request-deadline") return { withRequestDeadline };
      if (name === "../env") return { ENV: { API_URL: "https://api.test" } };
      if (name === "./local-bank-parser") return localParser;
      throw new Error(`Unexpected import ${name}`);
    },
    console, setTimeout, clearTimeout, AbortController, encodeURIComponent,
    fetch: async (url) => { calls++; return { ok: true, json: async () => respond ? respond(url, calls) : ({ kind: "unparsed", parser: "groq", reason: "uncertain" }) }; },
  });
  return { api: exports.api, calls: () => calls };
}
const envelope = { message: "Rs 100 debited from your A/c XX1234", sender: "VM-HDFCBK", sourceKey: "synthetic", sourcePackage: "sms.test", capturedAt: "2026-10-23T12:00:00Z" };

test("successful local parsing, review events and exclusions never call the cloud, including offline", async () => {
  const { api, calls } = harness();
  for (const [message, kind] of [
    [envelope.message, "transaction"],
    ["Lien of INR 500 marked on account **1234", "review_event"],
    ["123456 is your OTP for payment of Rs 500", "non_transaction"],
  ]) {
    assert.equal((await api.parseBankNotification({ ...envelope, message }, false)).kind, kind);
    assert.equal((await api.parseBankNotification({ ...envelope, message }, true)).kind, kind);
  }
  assert.equal(calls(), 0);
});

test("unresolved formats call cloud once online and stay pending offline", async () => {
  const { api, calls } = harness();
  const unknown = { ...envelope, message: "UPI transaction INR 500 processed" };
  await assert.rejects(() => api.parseBankNotification(unknown, false), /when online/);
  assert.equal(calls(), 0);
  assert.equal((await api.parseBankNotification(unknown, true)).kind, "unparsed");
  assert.equal(calls(), 1);
});

 test("paged history only returns a complete deduplicated snapshot and refuses repeated cursors", async () => {
  const h = harness((_url, call) => call === 1 ? { transactions: [{ _id: 'first' }], nextCursor: 'next-page' } : { transactions: [{ _id: 'first' }, { _id: 'last' }], nextCursor: null });
  assert.equal((await h.api.getTransactions()).length, 2); assert.equal(h.calls(), 2);
  const broken = harness(() => ({ transactions: [{ _id: 'first' }], nextCursor: 'loop' }));
  await assert.rejects(broken.api.getTransactions(), /repeated a history page/);
  const failed = harness((_url, call) => { if (call === 2) throw new Error('Interrupted download'); return { transactions: [{ _id: 'partial' }], nextCursor: 'page-two' }; });
  await assert.rejects(failed.api.getTransactions(), /Interrupted download/);
});
