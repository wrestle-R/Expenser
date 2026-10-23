import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

const IST_OFFSET_MINUTES = 5 * 60 + 30;
// Keep amount tokens bounded: never truncate an unsupported decimal or currency.
const MONEY = String.raw`(?:Rs\.?|INR|₹)\s*[:.]?\s*([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)(?![0-9,]|\.[0-9])`;
const CURRENCY_AMOUNT_PATTERN = new RegExp(MONEY, "gi");
const ACCOUNT = /\b(?:SB\s+)?(?:A\s*\/?\s*c|Alc|Acc(?:t|ount)?)(?:\s*(?:no\.?|number|ending(?:\s+(?:in|with))?))?\s*[:.-]?\s*[*%xX.-]*\s*(\d{3,18})\b/i;
const CARD = /\bcard(?:\s*(?:no\.?|number|ending(?:\s+(?:in|with))?))?\s*[:.-]?\s*[*xX.-]*\s*(\d{4,16})\b/i;

function normalizeBankMessage(value) {
  return String(value ?? "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}

function parseAmount(value, allowZero = false) {
  const amount = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(amount) && (allowZero ? amount >= 0 : amount > 0)
    ? amount
    : null;
}

function parseIndianDate(datePart, timePart, meridiem, capturedAt) {
  const dateMatch = /^(\d{1,2})[-/ ](\d{1,2}|[a-z]{3,9})[-/ ](\d{2}|\d{4})$/i.exec(datePart);
  if (!dateMatch) return null;
  const day = Number(dateMatch[1]);
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = /^\d+$/.test(dateMatch[2]) ? Number(dateMatch[2]) : monthNames.indexOf(dateMatch[2].slice(0, 3).toLowerCase()) + 1;
  const year = Number(dateMatch[3]) + (dateMatch[3].length === 2 ? 2000 : 0);
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return null;

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

  const utcMs =
    Date.UTC(Number(year), Number(month) - 1, Number(day), hours, minutes, seconds) -
    IST_OFFSET_MINUTES * 60 * 1000;
  const date = new Date(utcMs);
  const local = new Date(utcMs + IST_OFFSET_MINUTES * 60 * 1000);
  // JS rolls 31 February into March. An invalid date must go to fallback instead.
  if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day) return null;
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function capturedTimestamp(value) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractOccurredAt(text, capturedAt) {
  const match = /\b(\d{1,2}[-/](?:\d{1,2}|[a-z]{3,9})[-/](?:\d{4}|\d{2})|\d{1,2} [a-z]{3,9} (?:\d{4}|\d{2}))\b(?:[ T,]+(?:at\s+)?(\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*(AM|PM)?)?/i.exec(text);
  return match ? parseIndianDate(match[1], match[2], match[3], capturedAt) : capturedTimestamp(capturedAt);
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
    ["Union Bank of India", /Union Bank(?: of India)?|UNIONB/i],
    ["YES BANK", /YES\s*BANK|YESBNK/i],
    ["HDFC Bank", /HDFC(?:\s*Bank)?/i],
    ["ICICI Bank", /ICICI(?:\s*Bank)?/i],
    ["Axis Bank", /Axis\s*Bank|AXISBK/i],
    ["State Bank of India", /State Bank of India|\bSBI\b|SBIINB|SBIUPI|SBIPSG|SBIATM/i],
    ["Central Bank of India", /Central Bank of India|\bCBoI\b|CENTBK/i],
    ["Bank of Baroda", /Bank of Baroda|\bBOB\b|BOBTXN/i],
    ["Kotak Mahindra Bank", /Kotak(?: Mahindra)?(?: Bank)?|KOTAKB/i],
    ["Canara Bank", /Canara(?: Bank)?|CANBNK/i],
    ["Punjab National Bank", /Punjab National Bank|\bPNB\b|PNBSMS/i],
    ["IDFC FIRST Bank", /IDFC(?: FIRST)?(?: Bank)?|IDFCFB/i],
    ["IndusInd Bank", /IndusInd(?: Bank)?/i],
    ["Bank of India", /\bBank of India\b|BOIIND/i],
    ["Indian Bank", /Indian Bank|INDBNK/i],
    ["Federal Bank", /Federal Bank|FEDBNK/i],
    ["IDBI Bank", /IDBI(?: Bank)?/i],
    ["Indian Overseas Bank", /Indian Overseas Bank|IOBCHN/i],
    ["Bank of Maharashtra", /Bank of Maharashtra|MAHABK/i],
    ["AU Small Finance Bank", /AU Small Finance Bank|AUBANK/i],
    ["RBL Bank", /RBL Bank|RBLBNK/i],
  ];
  const haystack = `${text} ${sender ?? ""}`;
  return known.find(([, pattern]) => pattern.test(haystack))?.[0] ?? null;
}

function getNonTransactionReason(message) {
  const text = normalizeBankMessage(message);
  const rules = [
    ["payment_request", /requested money|money request|collect request|request(?:ed)? (?:you to )?pay|on approv(?:al|ing).{0,80}(?:will be|would be) debited|\b(?:payment|collect) request\b/i],
    ["future_debit", /\b(?:scheduled|upcoming|due)\b.{0,60}\b(?:debit|payment|autopay)\b|\b(?:debit|payment|autopay)\b.{0,50}\b(?:scheduled|upcoming|due on)\b|\b(?:will|would|may|shall)\s+(?:be\s+)?debited\b|\b(?:on approval|on approving).{0,80}\bdebited\b/i],
    ["failed_payment", /(?:payment|transaction|txn).{0,40}(?:failed|unsuccessful|pending)|declined|(?:could not|unable to).{0,30}(?:debit|process)|if debited.{0,80}(?:refund|reversed)/i],
    ["refund_promise", /\brefund\b.{0,80}\b(?:will|shall|may)\s+(?:be\s+)?credit(?:ed)?\b|\b(?:will|shall|may)\s+(?:receive|get)\b.{0,60}\brefund\b/i],
    ["promotion", /cashback\s+(?:offer|up to)|offer expiring|loan is ready|open your bank account|free cash|brand discount|pre-approved/i],
    ["otp_or_security", /\b(?:use\s+OTP|OTP\s+(?:is|for)|\d{4,8}\s+is\s+(?:your\s+)?OTP|one[- ]time\s+password|verification code)\b/i],
    ["telecom_recharge", /recharge.{0,50}(?:successful|credited|validity)|prepaid pack|postpaid/i],
  ];
  // A failed payment can be followed by a completed refund. Do not discard that credit.
  if (/\b(?:refunded|reversed|refund.{0,25}(?:credited|processed))\b/i.test(text) &&
      !/\b(?:will|would|shall|may)\b.{0,60}\b(?:refund|revers|credit)/i.test(text)) {
    const security = rules.find(([reason, pattern]) => reason === "otp_or_security" && pattern.test(text));
    return security?.[0] ?? null;
  }
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

function isFinancialNotificationLike(message) {
  const text = normalizeBankMessage(message);
  if (!text) return false;
  const hasMoney = new RegExp(MONEY, "i").test(text);
  const hasTransactionLanguage = /\b(?:debited|credited|debit|credit|spent|paid|withdrawn|deposited|received|reversed|refunded|sent|transferred|purchase|payment|txn|transaction|UPI|IMPS|NEFT|RTGS)\b/i.test(text);
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
  const ranked = matches.map((match) => {
    const prefix = text.slice(Math.max(0, match.index - 45), match.index);
    // Available balance, limits, and dues are never the transaction amount.
    const balance = /(?:bal(?:ance)?|limit|due|outstanding)\s*[:=.-]?\s*$/i.test(prefix);
    return { amount: parseAmount(match[1]), distance: Math.abs(match.index - directionIndex), balance };
  }).filter((item) => item.amount != null && !item.balance).sort((a, b) => a.distance - b.distance);
  if (!ranked.length) return null;
  // Two equally plausible amounts need the cloud/review path, not a guess.
  if (ranked.length > 1 && ranked[0].amount !== ranked[1].amount && ranked[1].distance - ranked[0].distance < 8) return null;
  return ranked[0].amount;
}

function extractReference(text) {
  const match = /\b(?:ref(?:erence)?\.?\s*(?:no\.?|number|id)?|UTR|RRN|UPI\s+(?:ref(?:erence)?\.?|txn)\s*(?:no\.?|id)?|transaction\s+id|txn\s+id)\s*[:#-]?\s*([^,]*?)(?=\s+(?:Avl|Avail(?:able)?)\.?\s*Bal\b|\s+Bal\s*[:=]|\s+(?:on|at|to|from|for)\s+|,|$)/i.exec(text);
  const value = normalizeBankMessage(match?.[1] ?? "").replace(/[.\s-]+$/g, "");
  if (!value || /^(?:Avl|Avail(?:able)?)?\.?\s*Bal\b/i.test(value)) return null;
  return (/^[A-Za-z0-9_-]*\d[A-Za-z0-9_-]{5,}/.exec(value)?.[0] ?? value).slice(0, 64);
}

function extractPayee(text, referenceNumber) {
  const direct = /\b(?:Fvg|To|At|towards)\s*:\s*(.*?)(?=\s+(?:Avl|Available)\s+Bal\b|,|$)/i.exec(text)?.[1];
  const towards = /\btowards\s+(.*?)(?=\s+(?:Avl|Available)\s+Bal\b|,|$)/i.exec(text)?.[1];
  const cardMerchant = /\b(?:debit(?:ed)?|spent)\b.*?\bon\s+(.*?)(?=\s+Bal(?:ance)?\s*[:=]|\s+(?:Not|If\s+not)\s+you|$)/i.exec(text)?.[1];
  const merchant = /\b(?:to|at|from)\s+(?!your\b|(?:a\/?c|account|card|INR|Rs)\b)(.*?)(?=\s+(?:on|using|via|with|ref(?:erence)?|UTR|RRN|UPI\s+ref|Avl|Avail(?:able)?|Bal(?:ance)?|Not you|If not)\b|[;,]|$)/i.exec(text)?.[1];
  const fvg = normalizePayee(direct ?? towards ?? merchant ?? cardMerchant);
  if (fvg) return fvg;
  if (referenceNumber && !/^\d{6,}$/.test(referenceNumber)) return normalizePayee(referenceNumber);
  return null;
}

function parseFinancialTransaction(message, context = {}) {
  if (typeof message !== "string") return null;
  const text = normalizeBankMessage(message);
  if (!isFinancialNotificationLike(text) || getNonTransactionReason(text)) return null;

  // Prefer completed verbs. "credit card debited" is an expense, and "debit card credited" an income.
  const direction = /\b(Debited|Spent|Paid|Withdrawn|Credited|Received|Deposited|Reversed|Refunded|Sent|Transferred)\b/i.exec(text)
    ?? /\b(Debit|Dr|Credit|Cr)\b(?!\s+card)/i.exec(text)
    ?? /\b(AutoPay)\b(?=.{0,80}\b(?:successful(?:ly)?|executed|processed|completed)\b)/i.exec(text);
  if (!direction) return null;
  if (/^transferred$/i.test(direction[1]) && !/\b(?:from|to)\s+(?:your\s+)?(?:a\/?c|account)\b/i.test(text)) return null;
  if (/^received$/i.test(direction[1]) && /\b(?:request|mandate|instruction|OTP|cheque)\b/i.test(text)) return null;
  const completedDirections = [...text.matchAll(/\b(debited|spent|paid|withdrawn|credited|deposited|refunded|reversed)\b/gi)];
  const hasExpense = completedDirections.some((m) => /^(debited|spent|paid|withdrawn)$/i.test(m[1]));
  const hasIncome = completedDirections.some((m) => /^(credited|deposited|refunded|reversed)$/i.test(m[1]));
  if (hasExpense && hasIncome) return null;
  const amount = extractAmount(text, direction.index);
  const occurredAt = extractOccurredAt(text, context.capturedAt);
  if (amount == null || !occurredAt) return null;

  const accountMatch = ACCOUNT.exec(text) ?? CARD.exec(text);
  const balanceMatch = new RegExp(String.raw`\b(?:(?:Avl|Avail(?:able)?)\.?\s*)?Bal(?:ance)?\s*[:=.-]?\s*${MONEY}`, "i").exec(text);
  const referenceNumber = extractReference(text);
  const incomingTransfer = /^transferred$/i.test(direction[1]) && /\bto\s+(?:your\s+)?(?:a\/?c|account)\b/i.test(text);
  const type = /^(?:debited|debit|dr|spent|paid|withdrawn|autopay|sent|transferred)$/i.test(direction[1]) && !incomingTransfer ? "expense" : "income";
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

function hasNotificationAmount(message, amount) {
  return [...normalizeBankMessage(message).matchAll(CURRENCY_AMOUNT_PATTERN)].some((match) => parseAmount(match[1]) === amount);
}

function hashNormalizedBankMessage(message) {
  return bytesToHex(sha256(utf8ToBytes(normalizeBankMessage(message))));
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
  hasNotificationAmount,
  isFinancialNotificationLike,
  isUnionBankLike,
  normalizeBankMessage,
  parseBankNotification,
  parseFinancialReviewEvent,
  parseFinancialTransaction,
  parseUnionBankNotification,
  parseUnionBankReviewEvent,
};
