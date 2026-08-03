import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBankImportKey,
  buildNotificationImportKey,
  hashNormalizedBankMessage,
  isFinancialNotificationLike,
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
const creditWithPayeeReference =
  "Alc %4280 Credited for Rs:5000.00 on 05-07-2026 15:03:59 by Mob Bk ref no PAUL D. RENJ Avl Bal Rs:5239.58.Never Share OTP/PIN/CVV-Union Bank of India";
const lienRemoval =
  "Dear customer,lien of Rs.79.36 due to LIEN FOR GENERAL SERVICE CHARGES has been removed from your account **74280on 30-06-2026 07:42:08.6425.Union Bank of India";
const debitWithoutBalance =
  "Union Bank of India A/C **4280 Debited INR 42.50 on 06/07/2026 8:04 PM ref no 123456789012";
const yesBankPrepaid =
  "INR 214.75 debited from your YES BANK prepaid card on BEST YPP COLLECTION ACCOUNT Bal: INR 905.25 Not you, contact 18001200";
const unionLienMarked =
  "Dear Customer,lien of Rs.79.36 has been marked on your A/c **74280 due to LIEN FOR GENERAL SERVICE CHARGES on 30-06-2026 07:41:08.6425.Union Bank of India";
const unionAutoPay =
  "Dear Customer, Your account has been successfully debited with Rs.499.00 on 03/08/2026 towards AWS India UPI AutoPay-Union Bank of India";
const unionNeftCredit =
  "Your SB A/c *4280 Credited for Rs. 5000.00 on 03-08-2026 10:03:59 by NEFT/ SOME PERSON UTR: BARBW123456789 Avl Bal Rs. 5239.58 -Union Bank of India";
const unionReversalCredit =
  "A/c *4280 Credited for Rs. 90.00 on 03-08-2026 10:15:22 by Mob Bk Rev Tran ref no 123456789012 Avl Bal Rs. 999.50 -Union Bank of India";
const chequePending =
  "Dear Customer, CHQ NO 123456 for Rs.800.00 received in clearing to the debit of ACCT XXXXXX4280 - CBoI";
const paymentRequest =
  "Flipkart Payments has requested money from you on your BHIM app. On approving the request, INR 599.00 will be debited from your account. NPCI";
const failedPayment =
  "Payment of Rs.499.00 has failed. Any amount, if debited will be refunded to your source account within a day.";
const rechargeCredit =
  "Hi, recharge of Rs.299 successfully credited to your Airtel number 9876543210, also the validity has been extended.";
const promotion =
  "Dear Customer, Rs.500 FREE CASH deposited in your wallet. Plus, FREE delivery! Avail the offers now.";

test("parses Union Bank debit notification with payee and reference", () => {
  const parsed = parseUnionBankNotification(debitSmall);
  assert.deepEqual(parsed, {
    bankName: "Union Bank of India",
    accountSuffix: "4280",
    type: "expense",
    amount: 3,
    currency: "INR",
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
  assert.equal(parsed?.type, "income");
  assert.equal(parsed?.amount, 5);
  assert.equal(parsed?.referenceNumber, null);
  assert.equal(parsed?.payee, null);
  assert.equal(parsed?.availableBalance, 504.19);
  assert.equal(parsed?.confidence, "high");
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
  assert.equal(result.parsed.payee, "PAUL RE");
  assert.equal(result.parsed.referenceNumber, "618022527796");
  assert.equal(result.parsed.availableBalance, 0.58);
});

test("uses a non-numeric reference as pending payee detail", () => {
  const result = parseBankNotification(creditWithNonNumericReference);
  assert.equal(result?.kind, "transaction");
  assert.equal(result.parsed.referenceNumber, "SUJANA FLORE");
  assert.equal(result.parsed.payee, "SUJANA FLORE");
});

test("parses Alc prefix and payee-like reference", () => {
  const result = parseBankNotification(creditWithPayeeReference);
  assert.equal(result?.kind, "transaction");
  assert.equal(result.parsed.amount, 5000);
  assert.equal(result.parsed.accountSuffix, "4280");
  assert.equal(result.parsed.payee, "PAUL D. RENJ");
  assert.equal(result.parsed.occurredAt, "2026-07-05T09:33:59.000Z");
});

test("parses A/C, INR, slash dates, 12-hour time, and no available balance", () => {
  const parsed = parseUnionBankNotification(debitWithoutBalance);
  assert.equal(parsed?.accountSuffix, "4280");
  assert.equal(parsed?.type, "expense");
  assert.equal(parsed?.amount, 42.5);
  assert.equal(parsed?.availableBalance, null);
  assert.equal(parsed?.occurredAt, "2026-07-06T14:34:00.000Z");
});

test("preserves a zero available balance", () => {
  const result = parseBankNotification(
    "A/c *4280 Debited Rs:10.00 on 03-08-2026 12:00:00 Avl Bal Rs:0.00 -Union Bank of India"
  );
  assert.equal(result?.kind, "transaction");
  assert.equal(result.parsed.availableBalance, 0);
});

test("parses YES Bank card debit using notification capture time", () => {
  const result = parseBankNotification(yesBankPrepaid, {
    sender: "VM-YESBNK",
    capturedAt: "2026-08-03T09:30:00.000Z",
  });
  assert.equal(result?.kind, "transaction");
  assert.equal(result.parsed.bankName, "YES BANK");
  assert.equal(result.parsed.accountSuffix, null);
  assert.equal(result.parsed.amount, 214.75);
  assert.equal(result.parsed.availableBalance, 905.25);
  assert.equal(result.parsed.payee, "BEST YPP COLLECTION ACCOUNT");
  assert.equal(result.parsed.occurredAt, "2026-08-03T09:30:00.000Z");
});

test("parses Union Bank AutoPay debit without an account suffix", () => {
  const result = parseBankNotification(unionAutoPay, {
    capturedAt: "2026-08-03T12:00:00.000Z",
  });
  assert.equal(result?.kind, "transaction");
  assert.equal(result.parsed.amount, 499);
  assert.equal(result.parsed.accountSuffix, null);
  assert.match(result.parsed.payee, /AWS India UPI AutoPay/i);
});

test("parses completed AutoPay and reversal messages without debit or credit wording", () => {
  const autopay = parseBankNotification(
    "AutoPay of INR 799 successfully processed for Stream Co.",
    { capturedAt: "2026-08-03T09:30:00.000Z", sender: "VM-BANK" }
  );
  const reversal = parseBankNotification(
    "INR 250 reversed to your account. Union Bank of India",
    { capturedAt: "2026-08-03T09:30:00.000Z" }
  );
  assert.equal(autopay?.kind, "transaction");
  assert.equal(autopay.parsed.type, "expense");
  assert.equal(reversal?.kind, "transaction");
  assert.equal(reversal.parsed.type, "income");
});

test("parses NEFT and reversal credit variants", () => {
  const neft = parseBankNotification(unionNeftCredit);
  const reversal = parseBankNotification(unionReversalCredit);
  assert.equal(neft?.kind, "transaction");
  assert.equal(neft.parsed.referenceNumber, "BARBW123456789");
  assert.equal(neft.parsed.availableBalance, 5239.58);
  assert.equal(reversal?.kind, "transaction");
  assert.equal(reversal.parsed.referenceNumber, "123456789012");
});

test("returns review events for lien removed, lien marked, and cheque clearing", () => {
  const removed = parseBankNotification(lienRemoval);
  const marked = parseBankNotification(unionLienMarked);
  const cheque = parseBankNotification(chequePending, {
    capturedAt: "2026-08-03T09:30:00.000Z",
  });
  assert.equal(removed?.kind, "review_event");
  assert.equal(removed.event.eventType, "lien_removed");
  assert.equal(removed.event.accountSuffix, "4280");
  assert.equal(marked?.kind, "review_event");
  assert.equal(marked.event.eventType, "lien_marked");
  assert.equal(cheque?.kind, "review_event");
  assert.equal(cheque.event.eventType, "cheque_pending_debit");
  assert.equal(cheque.event.bankName, "Central Bank of India");
});

test("rejects requests, failures, recharge credits, and promotions", () => {
  for (const [message, reason] of [
    [paymentRequest, "payment_request"],
    [failedPayment, "failed_payment"],
    [rechargeCredit, "telecom_recharge"],
    [promotion, "promotion"],
    ["INR 500 will be debited after mandate approval", "future_debit"],
    ["Your refund of INR 200 will be credited within five days", "refund_promise"],
    ["You received a collect request for Rs 950 via UPI", "payment_request"],
  ]) {
    const result = parseBankNotification(message, {
      capturedAt: "2026-08-03T09:30:00.000Z",
    });
    assert.equal(result?.kind, "non_transaction");
    assert.equal(result.reason, reason);
  }
});

test("recognizes financial candidates without accepting ordinary messages", () => {
  assert.equal(isFinancialNotificationLike(yesBankPrepaid), true);
  assert.equal(isFinancialNotificationLike(unionLienMarked), true);
  assert.equal(isFinancialNotificationLike("Lunch at 1?"), false);
});

test("builds stable legacy and generic import keys", () => {
  const parsed = parseUnionBankNotification(debitSmall);
  assert.equal(buildBankImportKey(parsed), "union-bank:ref:617163923155");
  const noRef = parseUnionBankNotification(creditMissingRef);
  assert.equal(
    buildBankImportKey(noRef, creditMissingRef),
    `union-bank:message:${hashNormalizedBankMessage(creditMissingRef)}`
  );
  const yes = parseBankNotification(yesBankPrepaid, {
    sender: "VM-YESBNK",
    capturedAt: "2026-08-03T09:30:00.000Z",
  });
  assert.equal(yes?.kind, "transaction");
  assert.match(
    buildNotificationImportKey(yes.parsed, {
      sender: "VM-YESBNK",
      message: yesBankPrepaid,
    }),
    /^sms:message:[a-f0-9]{64}$/
  );
});

test("returns null for unrelated or malformed notification text", () => {
  assert.equal(parseUnionBankNotification("Your OTP is 123456"), null);
  assert.equal(parseUnionBankNotification("Union Bank debited something"), null);
  assert.equal(parseBankNotification("Your OTP is 123456"), null);
});
