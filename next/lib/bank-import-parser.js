import { createHash } from "node:crypto";

const IST_OFFSET_MINUTES = 5 * 60 + 30;
const CURRENCY_AMOUNT_PATTERN = /(?:Rs\.?|INR|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/gi;

function normalizeBankMessage(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseAmount(value, allowZero = false) {
  const amount = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(amount) && (allowZero ? amount >= 0 : amount > 0)
    ? amount
    : null;
}

function parseIndianDate(datePart, timePart, meridiem, capturedAt) {
  const dateMatch = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(datePart);
  if (!dateMatch) return null;

  const captured = new Date(String(capturedAt ?? ""));
  const fallbackTime = Number.isNaN(captured.getTime())
    ? { hours: 12, minutes: 0, seconds: 0 }
    : (() => {
        const local = new Date(captured.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
        return {
          hours: local.getUTCHours(),
          minutes: local.getUTCMinutes(),
          seconds: local.getUTCSeconds(),
        };
      })();

  let hours = fallbackTime.hours;
  let minutes = fallbackTime.minutes;
  let seconds = fallbackTime.seconds;
  if (timePart) {
    const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(timePart);
    if (!timeMatch) return null;
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2]);
    seconds = Number(timeMatch[3] ?? 0);
    const marker = String(meridiem ?? "").toUpperCase();
    if (marker) {
      if (hours < 1 || hours > 12) return null;
      if (marker === "PM" && hours !== 12) hours += 12;
      if (marker === "AM" && hours === 12) hours = 0;
    }
  }

  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  const [, day, month, year] = dateMatch;
  const utcMs =
    Date.UTC(Number(year), Number(month) - 1, Number(day), hours, minutes, seconds) -
    IST_OFFSET_MINUTES * 60 * 1000;
  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function capturedTimestamp(value) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractOccurredAt(text, capturedAt) {
  const match = /\b(\d{2}[-/]\d{2}[-/]\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*(AM|PM)?)?/i.exec(
    text
  );
  return match
    ? parseIndianDate(match[1], match[2], match[3], capturedAt)
    : capturedTimestamp(capturedAt);
}

function normalizePayee(value) {
  const cleaned = String(value ?? "")
    .replace(/\s+(?:Avl|Available)\s+Bal.*$/i, "")
    .replace(/\s+Bal(?:ance)?\s*[:=].*$/i, "")
    .replace(/\s+Never\s+Share.*$/i, "")
    .replace(/\s+(?:Not|If\s+not)\s+you[?,]?.*$/i, "")
    .replace(/[.,\s-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function normalizeAccountSuffix(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? digits.slice(-4) : null;
}

function inferBankName(text, sender) {
  const known = [
    /Union Bank of India/i,
    /YES BANK/i,
    /HDFC Bank/i,
    /ICICI Bank/i,
    /Axis Bank/i,
    /State Bank of India|\bSBI\b/i,
    /Central Bank of India|\bCBoI\b/i,
    /Bank of Baroda|\bBOB\b/i,
    /Kotak Mahindra Bank|Kotak Bank/i,
    /Canara Bank/i,
    /Punjab National Bank|\bPNB\b/i,
    /IDFC FIRST Bank/i,
    /IndusInd Bank/i,
  ];
  const haystack = `${text} ${sender ?? ""}`;
  const match = known.map((pattern) => pattern.exec(haystack)).find(Boolean);
  if (!match) return null;
  const value = match[0];
  if (/^sbi$/i.test(value)) return "State Bank of India";
  if (/^cboi$/i.test(value)) return "Central Bank of India";
  if (/^bob$/i.test(value)) return "Bank of Baroda";
  if (/^pnb$/i.test(value)) return "Punjab National Bank";
  return value.replace(/\s+/g, " ").trim();
}

function getNonTransactionReason(message) {
  const text = normalizeBankMessage(message);
  const rules = [
    ["payment_request", /requested money|money request|collect request|request(?:ed)? (?:you to )?pay|on approv(?:al|ing).{0,80}(?:will be|would be) debited/i],
    ["future_debit", /\b(?:will|would|may|shall)\s+(?:be\s+)?debited\b|\b(?:on approval|on approving).{0,80}\bdebited\b/i],
    ["failed_payment", /payment.{0,40}failed|transaction.{0,40}failed|declined|if debited.{0,80}(?:refund|reversed)/i],
    ["refund_promise", /\brefund\b.{0,80}\b(?:will|shall|may)\s+(?:be\s+)?credit(?:ed)?\b|\b(?:will|shall|may)\s+(?:receive|get)\b.{0,60}\brefund\b/i],
    ["promotion", /cashback|offer expiring|loan is ready|open your bank account|free cash|brand discount/i],
    ["otp_or_security", /\b(?:use\s+OTP|OTP\s+(?:is|for)|one[- ]time\s+password)\b/i],
    ["telecom_recharge", /recharge.{0,50}(?:successful|credited|validity)|prepaid pack|postpaid/i],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

function isFinancialNotificationLike(message) {
  const text = normalizeBankMessage(message);
  if (!text) return false;
  const hasMoney = /(?:\bRs\.?|\bINR\b|₹)\s*:?\s*[\d,]+(?:\.\d{1,2})?/i.test(text);
  const hasTransactionLanguage = /\b(?:debited|credited|debit|credit|spent|paid|withdrawn|deposited|received|reversed)\b/i.test(text);
  const hasCompletedAutoPay = /\bautopay\b.{0,80}\b(?:successful(?:ly)?|executed|processed|completed)\b/i.test(text);
  return (
    (hasMoney && (hasTransactionLanguage || hasCompletedAutoPay)) ||
    /\blien\s+of\b/i.test(text) ||
    /received\s+in\s+clearing\s+to\s+the\s+debit/i.test(text)
  );
}

function isUnionBankLike(message) {
  const text = normalizeBankMessage(message);
  return /Union Bank of India/i.test(text) || /\b(?:A\/?c|Alc|Acct(?:ount)?)\s*(?:No\.?\s*)?[*%xX-]+\d{3,12}\b/i.test(text);
}

function extractAmount(text, directionIndex) {
  const matches = [...text.matchAll(CURRENCY_AMOUNT_PATTERN)];
  if (!matches.length) return null;
  const ranked = matches
    .map((match) => ({
      amount: parseAmount(match[1]),
      distance: Math.abs((match.index ?? 0) - directionIndex),
    }))
    .filter((item) => item.amount != null)
    .sort((a, b) => a.distance - b.distance);
  return ranked[0]?.amount ?? null;
}

function extractReference(text) {
  const match = /\b(?:ref(?:erence)?\s*(?:no\.?|number)?|UTR|transaction\s+id|txn\s+id)\s*[:#-]?\s*([^,]*?)(?=\s+(?:Avl|Available)\s+Bal\b|\s+Bal\s*[:=]|,|$)/i.exec(
    text
  );
  const value = normalizeBankMessage(match?.[1] ?? "").replace(/[.\s-]+$/g, "");
  if (!value || /^(?:Avl|Available)?\s*Bal\b/i.test(value)) return null;
  return value.slice(0, 64);
}

function extractPayee(text, referenceNumber) {
  const direct = /\b(?:Fvg|To|At|towards)\s*:\s*(.*?)(?=\s+(?:Avl|Available)\s+Bal\b|,|$)/i.exec(text)?.[1];
  const towards = /\btowards\s+(.*?)(?=\s+(?:Avl|Available)\s+Bal\b|,|$)/i.exec(text)?.[1];
  const cardMerchant = /\b(?:debit(?:ed)?|spent)\b.*?\bon\s+(.*?)(?=\s+Bal(?:ance)?\s*[:=]|\s+(?:Not|If\s+not)\s+you|$)/i.exec(text)?.[1];
  const fvg = normalizePayee(direct ?? towards ?? cardMerchant);
  if (fvg) return fvg;
  if (referenceNumber && !/^\d{6,}$/.test(referenceNumber)) return normalizePayee(referenceNumber);
  return null;
}

function parseFinancialTransaction(message, context = {}) {
  if (typeof message !== "string") return null;
  const text = normalizeBankMessage(message);
  if (!isFinancialNotificationLike(text) || getNonTransactionReason(text)) return null;

  const direction = /\b(Debited|Debit|Dr|Spent|Paid|Withdrawn|Credited(?:\s+for)?|Credit|Cr|Received|Deposited|Reversed)\b/i.exec(text)
    ?? /\b(AutoPay)\b(?=.{0,80}\b(?:successful(?:ly)?|executed|processed|completed)\b)/i.exec(text);
  if (!direction) return null;
  const amount = extractAmount(text, direction.index);
  const occurredAt = extractOccurredAt(text, context.capturedAt);
  if (amount == null || !occurredAt) return null;

  const accountMatch = /\b(?:SB\s+)?(?:A\/?c|Alc|Acct(?:ount)?)\s*(?:No\.?\s*)?[*%xX-]+\s*(\d{3,12})\b/i.exec(text);
  const balanceMatch = /\b(?:(?:Avl|Available)\s+)?Bal(?:ance)?\s*(?::|=)?\s*(?:Rs\.?|INR|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i.exec(text);
  const referenceNumber = extractReference(text);
  const type = /^(?:debited|debit|dr|spent|paid|withdrawn|autopay)$/i.test(direction[1]) ? "expense" : "income";
  const accountSuffix = normalizeAccountSuffix(accountMatch?.[1]);
  const availableBalance = balanceMatch ? parseAmount(balanceMatch[1], true) : null;
  const bankName = inferBankName(text, context.sender);

  return {
    bankName,
    accountSuffix,
    type,
    amount,
    currency: "INR",
    occurredAt,
    referenceNumber,
    payee: extractPayee(text, referenceNumber),
    availableBalance,
    confidence:
      (bankName || context.sender) && (referenceNumber || accountSuffix || availableBalance != null)
        ? "high"
        : "medium",
  };
}

function parseFinancialReviewEvent(message, context = {}) {
  if (typeof message !== "string") return null;
  const text = normalizeBankMessage(message.replace(/(\d)(on\s+\d{2}[-/]\d{2}[-/]\d{4})/i, "$1 $2"));
  const bankName = inferBankName(text, context.sender);
  const occurredAt = extractOccurredAt(text, context.capturedAt);

  const lien = /\blien\s+of\s+(?:(?:Rs\.?|INR|₹)\s*)?:?\s*([\d,]+(?:\.\d{1,2})?).*?\b(?:removed|marked)\b/i.exec(text);
  if (lien) {
    const removed = /\bremoved\b/i.test(text);
    const accountMatch = /\b(?:account|A\/?c)\s+\*+(\d{3,12})/i.exec(text);
    return {
      bankName,
      eventType: removed ? "lien_removed" : "lien_marked",
      amount: parseAmount(lien[1]),
      accountSuffix: normalizeAccountSuffix(accountMatch?.[1]),
      occurredAt,
      summary: removed ? "Lien removed for service charges" : "Lien marked for service charges",
      confidence: "medium",
    };
  }

  const cheque = /\bCHQ\s+NO\s+\S+\s+for\s+(?:Rs\.?|INR|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?).*?received\s+in\s+clearing\s+to\s+the\s+debit\s+of\s+(?:A\/?C|ACCT)\s+[X*]*(\d{3,12})/i.exec(text);
  if (cheque) {
    return {
      bankName,
      eventType: "cheque_pending_debit",
      amount: parseAmount(cheque[1]),
      accountSuffix: normalizeAccountSuffix(cheque[2]),
      occurredAt,
      summary: "Cheque received in clearing",
      confidence: "medium",
    };
  }
  return null;
}

function parseUnionBankNotification(message, context = {}) {
  if (!isUnionBankLike(message)) return null;
  const parsed = parseFinancialTransaction(message, context);
  return parsed ? { ...parsed, bankName: "Union Bank of India" } : null;
}

function parseUnionBankReviewEvent(message, context = {}) {
  if (!isUnionBankLike(message)) return null;
  const event = parseFinancialReviewEvent(message, context);
  return event ? { ...event, bankName: "Union Bank of India" } : null;
}

function parseBankNotification(message, context = {}) {
  const reason = getNonTransactionReason(message);
  if (reason && isFinancialNotificationLike(message)) {
    return { kind: "non_transaction", reason };
  }
  const event = parseFinancialReviewEvent(message, context);
  if (event) return { kind: "review_event", event };
  const transaction = parseFinancialTransaction(message, context);
  return transaction ? { kind: "transaction", parsed: transaction } : null;
}

function hashNormalizedBankMessage(message) {
  return createHash("sha256").update(normalizeBankMessage(message)).digest("hex");
}

function canonicalBankSlug(value) {
  const slug = normalizeBankMessage(value ?? "bank")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "bank";
}

function canonicalReference(value) {
  const reference = normalizeBankMessage(value).replace(/[^A-Za-z0-9_-]+/g, "");
  return reference || null;
}

function buildCanonicalImportKey(parsed, message) {
  if (!parsed) return null;
  const bank = canonicalBankSlug(parsed.bankName);
  const account = normalizeAccountSuffix(parsed.accountSuffix) ?? "unknown";
  const reference = canonicalReference(parsed.referenceNumber);
  if (reference) return `bank:${bank}:${account}:ref:${reference}`;
  if (message) {
    return `bank:${bank}:${account}:message:${hashNormalizedBankMessage(message)}`;
  }
  return [
    "bank",
    bank,
    account,
    "fallback",
    parsed.type,
    Number(parsed.amount).toFixed(2),
    parsed.occurredAt,
  ].join(":");
}

function buildBankImportKey(parsed, message) {
  return buildCanonicalImportKey(parsed, message);
}

function buildBankReviewEventKey(event, message) {
  if (!event) return null;
  if (message) return `union-bank:event:message:${hashNormalizedBankMessage(message)}`;
  return ["union-bank:event", event.eventType, event.accountSuffix ?? "unknown", event.amount == null ? "unknown" : Number(event.amount).toFixed(2), event.occurredAt ?? "unknown"].join(":");
}

function buildNotificationImportKey(parsed, envelope) {
  return buildCanonicalImportKey(parsed, envelope?.message);
}

function buildNotificationReviewKey(event, envelope) {
  const sender = normalizeBankMessage(envelope?.sender ?? event?.bankName ?? "sms").toLowerCase();
  return `sms:event:${hashNormalizedBankMessage(`${sender}|${envelope?.message ?? event?.summary ?? ""}`)}`;
}

export {
  buildBankImportKey,
  buildBankReviewEventKey,
  buildNotificationImportKey,
  buildNotificationReviewKey,
  getNonTransactionReason,
  hashNormalizedBankMessage,
  isFinancialNotificationLike,
  isUnionBankLike,
  normalizeBankMessage,
  parseBankNotification,
  parseFinancialReviewEvent,
  parseFinancialTransaction,
  parseUnionBankNotification,
  parseUnionBankReviewEvent,
};
