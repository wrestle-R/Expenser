import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { parseNotificationLocally } from "./local-bank-parser.js";
import { hashNormalizedBankMessage } from "expenser-bank-notifications/parser.js";

const context = { sender: "VM-HDFCBK", capturedAt: "2026-10-23T12:00:00.000Z", sourceKey: "synthetic", sourcePackage: "sms.test" };
const parse = (message, sender = context.sender) => parseNotificationLocally({ ...context, sender, message });

test("handles bank sender IDs, masked and ending account/card formats, and debit/credit card direction", () => {
  const fixtures = [
    ["Rs.1,250.50 debited from A/c XX1234 to CORNER SHOP on 23-10-26. UPI Ref No 123456789012. Avl Bal Rs.8,749.50", "VM-HDFCBK", "HDFC Bank", "expense", 1250.50, "1234"],
    ["ICICI Bank Acct XX5678 credited INR 20,000 on 23-Oct-2026 by NEFT. UTR ABC123456. Avail Bal INR 25,000", "VM-ICICIB", "ICICI Bank", "income", 20000, "5678"],
    ["INR 699.00 spent on your credit card ending 4321 at CORNER SHOP on 23/10/26 8:04 PM", "VM-AXISBK", "Axis Bank", "expense", 699, "4321"],
    ["Your debit card XX4321 credited Rs 699.00 on 23-10-2026", "VM-SBIUPI", "State Bank of India", "income", 699, "4321"],
    ["Your account ending in 9876 has been debited by INR 1,23,456.78 on 23 Oct 2026", "VM-KOTAKB", "Kotak Mahindra Bank", "expense", 123456.78, "9876"],
    ["Rs 45 sent from your a/c XX3333 via UPI to TEST MERCHANT", "VM-CANBNK", "Canara Bank", "expense", 45, "3333"],
  ];
  for (const [message, sender, bank, type, amount, account] of fixtures) {
    const result = parse(message, sender);
    assert.equal(result?.kind, "transaction", message);
    assert.equal(result.parsed.bankName, bank);
    assert.equal(result.parsed.type, type);
    assert.equal(result.parsed.amount, amount);
    assert.equal(result.parsed.accountSuffix, account);
    assert.equal(result.parser, "regex");
  }
});

test("separates transaction amounts from balances, limits, dues and references", () => {
  const result = parse("Available balance INR 9,999.00. A/c XX1234 debited Rs 100.50. Ref No 123456789012. Credit limit INR 50,000.00");
  assert.equal(result?.parsed?.amount, 100.50);
  assert.equal(result?.parsed?.availableBalance, 9999);
  assert.equal(result?.parsed?.referenceNumber, "123456789012");
  assert.equal(parse("A/c XX1234 debited. Available balance Rs 500"), null);
  assert.equal(parse("A/c XX1234 debited Rs 12.345"), null);
});

test("does not convert pending, requested, failed, OTP or future transactions into expenses", () => {
  for (const message of [
    "123456 is your OTP for payment of INR 500 on credit card 1234",
    "Payment request INR 500 received. Approve to pay.",
    "Your account will be debited INR 500 tomorrow",
    "Transaction for Rs 500 is pending",
    "Payment of INR 500 declined",
    "Your refund of INR 500 will be credited in 5 days",
    "Cashback offer up to Rs 500 credited on qualifying purchases",
  ]) assert.equal(parse(message)?.kind, "non_transaction", message);
});

test("accepts completed refunds and cashback credits, including a preceding failed payment", () => {
  for (const message of [
    "Cashback of Rs 50 credited to your account XX1234",
    "Payment failed. Rs 500 refunded to your account XX1234",
    "Rs 500 reversed to your account XX1234",
  ]) {
    const result = parse(message);
    assert.equal(result?.kind, "transaction", message);
    assert.equal(result.parsed.type, "income");
  }
});

test("uses IST with short dates, named months and AM/PM; rejects calendar rollover", () => {
  assert.equal(parse("Rs 10 paid on 23-Oct-26 8:04 PM")?.parsed.occurredAt, "2026-10-23T14:34:00.000Z");
  assert.equal(parse("Rs 10 paid on 23/10/2026 12:00 AM")?.parsed.occurredAt, "2026-10-22T18:30:00.000Z");
  for (const date of ["31-02-2026", "29-02-2025", "23-13-2026", "23-10-2026 25:00"]) {
    assert.equal(parse(`Rs 10 paid on ${date}`), null, date);
  }
});

test("preserves uncertainty for missing amounts, directions or conflicting debit/credit events", () => {
  for (const message of [
    "UPI transaction Rs 500 processed",
    "INR 100 transferred successfully", // cannot infer direction without an account relation
    "Rs 100 debited and Rs 200 credited to A/c XX1234",
    "Your card payment of INR 500", // no confirmation
  ]) assert.equal(parse(message), null, message);
});

test("mobile canonical keys match server SHA-256 including Unicode and repeated whitespace", () => {
  const message = "₹ 500 credited to a/c XX1234 from दुकान";
  assert.equal(hashNormalizedBankMessage(message), createHash("sha256").update(message).digest("hex"));
  assert.equal(parse(message).importSourceKey, parse(message.replace(/ /g, "  ")).importSourceKey);
});
