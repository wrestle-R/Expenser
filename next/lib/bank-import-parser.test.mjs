import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBankImportKey,
  parseUnionBankNotification,
} from "./bank-import-parser.js";

const debitSmall =
  "Union Bank of India A/c *4280 Debited Rs:3.00 on 20-06-2026 18:10:45 by Mob Bk ref no 617163923155, Fvg: FAIZAN A Avl Bal Rs:16.79. Not you?Call 18002333/SMS BLOCK 4280 to 8879365472";

const debitLarge =
  "Union Bank of India A/c *4280 Debited Rs:260.00 on 14-06-2026 11:07:58 by Mob Bk ref no 653166636855, Fvg: SHADAB A Avl Bal Rs:244.19. Not you?Call 18002333/SMS BLOCK 4280 to 8879365472";

const creditMissingRef =
  "A/c *4280 Credited for Rs:5.00 on 13-06-2026 17:30:43 by Mob Bk ref no  Avl Bal Rs:504.19.Never Share OTP/PIN/CVV-Union Bank of India";

test("parses Union Bank debit notification with payee and reference", () => {
  const parsed = parseUnionBankNotification(debitSmall);

  assert.deepEqual(parsed, {
    bankName: "Union Bank of India",
    accountSuffix: "4280",
    type: "expense",
    amount: 3,
    occurredAt: "2026-06-20T12:40:45.000Z",
    referenceNumber: "617163923155",
    payee: "FAIZAN A",
    availableBalance: 16.79,
    confidence: "high",
  });
});

test("parses a second Union Bank debit format consistently", () => {
  const parsed = parseUnionBankNotification(debitLarge);

  assert.equal(parsed?.type, "expense");
  assert.equal(parsed?.amount, 260);
  assert.equal(parsed?.payee, "SHADAB A");
  assert.equal(parsed?.availableBalance, 244.19);
  assert.equal(parsed?.referenceNumber, "653166636855");
});

test("parses Union Bank credit notification without reference number", () => {
  const parsed = parseUnionBankNotification(creditMissingRef);

  assert.deepEqual(parsed, {
    bankName: "Union Bank of India",
    accountSuffix: "4280",
    type: "income",
    amount: 5,
    occurredAt: "2026-06-13T12:00:43.000Z",
    referenceNumber: null,
    payee: null,
    availableBalance: 504.19,
    confidence: "medium",
  });
});

test("builds a stable import key from reference number when present", () => {
  const parsed = parseUnionBankNotification(debitSmall);

  assert.equal(
    buildBankImportKey(parsed),
    "union-bank:ref:617163923155"
  );
});

test("builds a stable fallback import key when reference number is missing", () => {
  const parsed = parseUnionBankNotification(creditMissingRef);

  assert.equal(
    buildBankImportKey(parsed),
    "union-bank:fallback:4280:income:5.00:2026-06-13T12:00:43.000Z:504.19"
  );
});

test("returns null for unrelated or malformed notification text", () => {
  assert.equal(parseUnionBankNotification("Your OTP is 123456"), null);
  assert.equal(parseUnionBankNotification("Union Bank debited something"), null);
});
