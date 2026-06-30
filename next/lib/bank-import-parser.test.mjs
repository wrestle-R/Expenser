import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBankImportKey,
  parseBankNotification,
  parseUnionBankNotification,
} from "./bank-import-parser.js";

const debitSmall =
  "Union Bank of India A/c *4280 Debited Rs:3.00 on 20-06-2026 18:10:45 by Mob Bk ref no 617163923155, Fvg: FAIZAN A Avl Bal Rs:16.79. Not you?Call 18002333/SMS BLOCK 4280 to 8879365472";

const debitLarge =
  "Union Bank of India A/c *4280 Debited Rs:260.00 on 14-06-2026 11:07:58 by Mob Bk ref no 653166636855, Fvg: SHADAB A Avl Bal Rs:244.19. Not you?Call 18002333/SMS BLOCK 4280 to 8879365472";

const creditMissingRef =
  "A/c *4280 Credited for Rs:5.00 on 13-06-2026 17:30:43 by Mob Bk ref no  Avl Bal Rs:504.19.Never Share OTP/PIN/CVV-Union Bank of India";

const creditWithReference =
  "A/c *4280 Credited for Rs:295.00 on 11-06-2026 22:03:02 by Mob Bk ref no 652848858787 Avl Bal Rs:514.04.Never Share OTP/PIN/CVV-Union Bank of India";

const debitWithPayee =
  "Union Bank of India A/c *4280 Debited Rs:626.00 on 29-06-2026 07:45:20 by Mob Bk ref no 618022527796, Fvg: PAUL  RE Avl Bal Rs:0.58. Not you?Call 18002333/SMS BLOCK 4280 to 8879365472";

const creditWithNonNumericReference =
  "there are a A/c *4280 Credited for Rs:698.00 on 29-06-2026 07:21:47 by Mob Bk ref no SUJANA FLORE Avl Bal Rs:626.58.Never Share OTP/PIN/CVV-Union Bank of India";

const lienRemoval =
  "Dear customer,lien of Rs.79.36 due to LIEN FOR GENERAL SERVICE CHARGES has been removed from your account **74280on 30-06-2026 07:42:08.6425.Union Bank of India";

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

test("parses Union Bank credit notification with a numeric reference", () => {
  const result = parseBankNotification(creditWithReference);

  assert.equal(result?.kind, "transaction");
  assert.equal(result.parsed.type, "income");
  assert.equal(result.parsed.amount, 295);
  assert.equal(result.parsed.accountSuffix, "4280");
  assert.equal(result.parsed.referenceNumber, "652848858787");
  assert.equal(result.parsed.availableBalance, 514.04);
  assert.equal(result.parsed.occurredAt, "2026-06-11T16:33:02.000Z");
});

test("parses Union Bank debit notification with payee containing extra spaces", () => {
  const result = parseBankNotification(debitWithPayee);

  assert.equal(result?.kind, "transaction");
  assert.equal(result.parsed.type, "expense");
  assert.equal(result.parsed.amount, 626);
  assert.equal(result.parsed.referenceNumber, "618022527796");
  assert.equal(result.parsed.payee, "PAUL RE");
  assert.equal(result.parsed.availableBalance, 0.58);
});

test("parses Union Bank credit notification with a non-numeric reference as pending detail", () => {
  const result = parseBankNotification(creditWithNonNumericReference);

  assert.equal(result?.kind, "transaction");
  assert.equal(result.parsed.type, "income");
  assert.equal(result.parsed.amount, 698);
  assert.equal(result.parsed.referenceNumber, null);
  assert.equal(result.parsed.payee, "SUJANA FLORE");
  assert.equal(result.parsed.confidence, "medium");
});

test("returns review event for Union Bank lien removal with missing spacing and fractional seconds", () => {
  const result = parseBankNotification(lienRemoval);

  assert.deepEqual(result, {
    kind: "review_event",
    event: {
      bankName: "Union Bank of India",
      eventType: "lien_removed",
      amount: 79.36,
      accountSuffix: "4280",
      occurredAt: "2026-06-30T02:12:08.000Z",
      summary: "Lien removed for general service charges",
      confidence: "medium",
    },
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
  assert.equal(parseBankNotification("Your OTP is 123456"), null);
});
