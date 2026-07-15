import { createHash } from "node:crypto";

const IST_OFFSET_MINUTES = 5 * 60 + 30;

function normalizeBankMessage(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseAmount(value) {
  const amount = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function parseUnionBankDate(datePart, timePart, meridiem) {
  const dateMatch = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(datePart);
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(timePart);
  if (!dateMatch || !timeMatch) return null;
  const [, day, month, year] = dateMatch;
  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = Number(timeMatch[3] ?? 0);
  const normalizedMeridiem = String(meridiem ?? "").toUpperCase();
  if (normalizedMeridiem) {
    if (hours < 1 || hours > 12) return null;
    if (normalizedMeridiem === "PM" && hours !== 12) hours += 12;
    if (normalizedMeridiem === "AM" && hours === 12) hours = 0;
  }
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  const utcMs = Date.UTC(Number(year), Number(month) - 1, Number(day), hours, minutes, seconds) - IST_OFFSET_MINUTES * 60 * 1000;
  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePayee(value) {
  const cleaned = String(value ?? "")
    .replace(/\s+(?:Avl|Available)\s+Bal.*$/i, "")
    .replace(/\s+Never\s+Share.*$/i, "")
    .replace(/\s+Not\s+you\?.*$/i, "")
    .replace(/[.,\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function normalizeAccountSuffix(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? digits.slice(-4) : null;
}

function isUnionBankLike(message) {
  const text = normalizeBankMessage(message);
  return /Union Bank of India/i.test(text) || /\b(?:A\/?c|Alc|Acct(?:ount)?)\s*(?:No\.?\s*)?[*%xX-]+\d{3,12}\b/i.test(text);
}

function parseUnionBankNotification(message) {
  if (typeof message !== "string") return null;
  const text = normalizeBankMessage(message);
  if (!isUnionBankLike(text)) return null;
  const accountMatch = /\b(?:A\/?c|Alc|Acct(?:ount)?)\s*(?:No\.?\s*)?[*%xX-]+\s*(\d{3,12})\b/i.exec(text);
  const directionMatch = /\b(Debited|Debit|Dr|Credited(?:\s+for)?|Credit|Cr)\b/i.exec(text);
  const dateMatch = /\b(\d{2}[-/]\d{2}[-/]\d{4})\s+(\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*(AM|PM)?\b/i.exec(text);
  if (!accountMatch || !directionMatch || !dateMatch) return null;
  const afterDirection = text.slice(directionMatch.index + directionMatch[0].length);
  const amountMatch = /(?:Rs\.?|INR|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i.exec(afterDirection);
  if (!amountMatch) return null;
  const balanceMatch = /\b(?:Avl|Available)\s+Bal(?:ance)?\s*(?:Rs\.?|INR|₹)?\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i.exec(text);
  const amount = parseAmount(amountMatch[1]);
  const availableBalance = balanceMatch ? parseAmount(balanceMatch[1]) : null;
  const occurredAt = parseUnionBankDate(dateMatch[1], dateMatch[2], dateMatch[3]);
  const accountSuffix = normalizeAccountSuffix(accountMatch[1]);
  if (amount == null || !occurredAt || !accountSuffix) return null;
  const refMatch = /\bref(?:erence)?\s*(?:no\.?|number)?\s*[:#-]?\s*([^,]*?)(?=\s+(?:Avl|Available)\s+Bal\b|,|$)/i.exec(text);
  const payeeMatch = /\b(?:Fvg|To|At)\s*:\s*(.*?)(?=\s+(?:Avl|Available)\s+Bal\b|$)/i.exec(text);
  const rawReference = normalizeBankMessage(refMatch?.[1] ?? "");
  const referenceNumber = /^\d{6,}$/.test(rawReference) ? rawReference : null;
  const payee = normalizePayee(payeeMatch?.[1]) ?? (rawReference && !referenceNumber && !/^(?:Avl|Available)\s+Bal\b/i.test(rawReference) ? normalizePayee(rawReference) : null);
  return {
    bankName: "Union Bank of India",
    accountSuffix,
    type: /^(?:debited|debit|dr)$/i.test(directionMatch[1]) ? "expense" : "income",
    amount,
    occurredAt,
    referenceNumber,
    payee,
    availableBalance,
    confidence: referenceNumber && availableBalance != null ? "high" : "medium",
  };
}

function parseUnionBankReviewEvent(message) {
  if (typeof message !== "string") return null;
  const text = normalizeBankMessage(message.replace(/(\d)(on\s+\d{2}[-/]\d{2}[-/]\d{4})/i, "$1 $2"));
  if (!isUnionBankLike(text)) return null;
  const match = /\blien\s+of\s+(?:Rs\.?)?\s*:?\s*([\d,]+(?:\.\d{1,2})?).*?\bremoved\b.*?\baccount\s+\*+(\d{3,12})\s*on\s+(\d{2}[-/]\d{2}[-/]\d{4})\s+(\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*(AM|PM)?/i.exec(text);
  if (!match) return null;
  const amount = parseAmount(match[1]);
  const accountSuffix = normalizeAccountSuffix(match[2]);
  const occurredAt = parseUnionBankDate(match[3], match[4], match[5]);
  if (amount == null || !accountSuffix || !occurredAt) return null;
  return { bankName: "Union Bank of India", eventType: "lien_removed", amount, accountSuffix, occurredAt, summary: "Lien removed for general service charges", confidence: "medium" };
}

function parseBankNotification(message) {
  const transaction = parseUnionBankNotification(message);
  if (transaction) return { kind: "transaction", parsed: transaction };
  const event = parseUnionBankReviewEvent(message);
  return event ? { kind: "review_event", event } : null;
}

function hashNormalizedBankMessage(message) {
  return createHash("sha256").update(normalizeBankMessage(message)).digest("hex");
}

function buildBankImportKey(parsed, message) {
  if (!parsed) return null;
  if (parsed.referenceNumber) return `union-bank:ref:${parsed.referenceNumber}`;
  if (message) return `union-bank:message:${hashNormalizedBankMessage(message)}`;
  return ["union-bank:fallback", parsed.accountSuffix, parsed.type, Number(parsed.amount).toFixed(2), parsed.occurredAt].join(":");
}

function buildBankReviewEventKey(event, message) {
  if (!event) return null;
  if (message) return `union-bank:event:message:${hashNormalizedBankMessage(message)}`;
  return ["union-bank:event", event.eventType, event.accountSuffix ?? "unknown", event.amount == null ? "unknown" : Number(event.amount).toFixed(2), event.occurredAt ?? "unknown"].join(":");
}

export {
  buildBankImportKey,
  buildBankReviewEventKey,
  hashNormalizedBankMessage,
  isUnionBankLike,
  normalizeBankMessage,
  parseBankNotification,
  parseUnionBankNotification,
  parseUnionBankReviewEvent,
};
