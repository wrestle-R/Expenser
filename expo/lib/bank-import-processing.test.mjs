import assert from "node:assert/strict";
import test from "node:test";

import { processBankImportCandidate } from "./bank-import-processing.js";

const candidate = {
  sourceKey: "sms:raw:fixture",
  sender: "VM-BANK",
  message: "INR 100 debited",
  capturedAt: "2026-08-03T09:30:00.000Z",
  sourcePackage: "com.google.android.apps.messaging",
};

function transaction(parser) {
  return {
    kind: "transaction",
    parser,
    importSource: "sms_notification",
    importSourceKey: "sms:message:fixture",
    parsed: { type: "expense", amount: 100 },
  };
}

for (const parser of ["regex", "groq"]) {
  test(`clears after ${parser} transaction is durably queued`, async () => {
    let queued = false;
    const kind = await processBankImportCandidate({
      candidate,
      parse: async () => transaction(parser),
      queueTransaction: async () => { queued = true; },
      saveReview: async () => false,
    });
    assert.equal(kind, "transaction");
    assert.equal(queued, true);
  });
}

test("retains candidate when offline, rate limited, unavailable, or local queueing fails", async () => {
  for (const error of [
    new Error("offline"),
    Object.assign(new Error("rate limited"), { status: 429 }),
    Object.assign(new Error("unavailable"), { status: 503 }),
  ]) {
    await assert.rejects(() => processBankImportCandidate({
      candidate,
      parse: async () => { throw error; },
      queueTransaction: async () => {},
      saveReview: async () => true,
    }));
  }

  await assert.rejects(() => processBankImportCandidate({
    candidate,
    parse: async () => transaction("regex"),
    queueTransaction: async () => { throw new Error("outbox write failed"); },
    saveReview: async () => true,
  }));
});

test("saves review and unparsed outcomes before allowing clear", async () => {
  for (const response of [
    { kind: "review_event", parser: "regex", event: {} },
    { kind: "unparsed", parser: "groq", reason: "uncertain" },
  ]) {
    let savedKind = null;
    const kind = await processBankImportCandidate({
      candidate,
      parse: async () => response,
      queueTransaction: async () => {},
      saveReview: async (value) => {
        savedKind = value.kind;
        return true;
      },
    });
    assert.equal(kind, response.kind);
    assert.equal(savedKind, response.kind);
  }
});

test("retains a review candidate when local persistence fails", async () => {
  await assert.rejects(() => processBankImportCandidate({
    candidate,
    parse: async () => ({ kind: "unparsed", parser: "groq", reason: "uncertain" }),
    queueTransaction: async () => {},
    saveReview: async () => false,
  }), /could not be saved/);
});

test("clears confirmed non-transactions without writing local data", async () => {
  let wrote = false;
  const kind = await processBankImportCandidate({
    candidate,
    parse: async () => ({ kind: "non_transaction", parser: "regex", reason: "otp" }),
    queueTransaction: async () => { wrote = true; },
    saveReview: async () => { wrote = true; return true; },
  });
  assert.equal(kind, "non_transaction");
  assert.equal(wrote, false);
});
