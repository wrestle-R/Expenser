const IST_OFFSET_MINUTES = 5 * 60 + 30;

function parseAmount(value) {
  const amount = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function parseUnionBankDate(datePart, timePart) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(datePart);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const timeMatch = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(timePart);
  if (!timeMatch) {
    return null;
  }

  const [, rawHours, rawMinutes, rawSeconds] = timeMatch;
  const [hours, minutes, seconds] = [rawHours, rawMinutes, rawSeconds].map(Number);
  if ([hours, minutes, seconds].some((part) => !Number.isFinite(part))) {
    return null;
  }

  const utcMs =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      hours,
      minutes,
      seconds
    ) -
    IST_OFFSET_MINUTES * 60 * 1000;

  return new Date(utcMs).toISOString();
}

function normalizePayee(value) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/\s+Avl\s+Bal.*$/i, "")
    .replace(/\s+Never\s+Share.*$/i, "")
    .replace(/\s+Not\s+you\?.*$/i, "")
    .replace(/[.,\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function normalizeAccountSuffix(value) {
  if (!value) {
    return null;
  }

  const digits = String(value).replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  return digits.length > 4 ? digits.slice(-4) : digits;
}

function normalizeSummary(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function isUnionBankLike(message) {
  if (typeof message !== "string") {
    return false;
  }

  return /Union Bank of India/i.test(message) || /\bA\/c\s+\*\d{3,8}\b/i.test(message);
}

function parseUnionBankNotification(message) {
  if (typeof message !== "string") {
    return null;
  }

  const text = message.replace(/\s+/g, " ").trim();
  if (!isUnionBankLike(text)) {
    return null;
  }

  const coreMatch =
    /\bA\/c\s+\*(\d{3,8})\s+(Debited|Credited(?:\s+for)?)\s+Rs:?([\d,]+(?:\.\d{1,2})?)\s+on\s+(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/i.exec(
      text
    );
  const balanceMatch = /\bAvl\s+Bal\s+Rs:?([\d,]+(?:\.\d{1,2})?)/i.exec(text);

  if (!coreMatch || !balanceMatch) {
    return null;
  }

  const [, accountSuffix, rawType, rawAmount, datePart, timePart] = coreMatch;
  const amount = parseAmount(rawAmount);
  const availableBalance = parseAmount(balanceMatch[1]);
  const occurredAt = parseUnionBankDate(datePart, timePart);
  const normalizedAccountSuffix = normalizeAccountSuffix(accountSuffix);

  if (amount == null || availableBalance == null || !occurredAt || !normalizedAccountSuffix) {
    return null;
  }

  const refValueMatch = /\bref\s+no\s+([^,]*?)(?=\s+Avl\s+Bal\b|,|$)/i.exec(text);
  const payeeMatch = /\bFvg:\s*(.*?)(?:\s+Avl\s+Bal\b|$)/i.exec(text);
  const rawReferenceValue = normalizeSummary(refValueMatch?.[1] ?? "");
  const rawReference = /^Avl\s+Bal\b/i.test(rawReferenceValue) ? "" : rawReferenceValue;
  const referenceNumber = /^\d{6,}$/.test(rawReference) ? rawReference : null;
  const payee = normalizePayee(payeeMatch?.[1]) ?? (rawReference && !referenceNumber ? normalizePayee(rawReference) : null);

  return {
    bankName: "Union Bank of India",
    accountSuffix: normalizedAccountSuffix,
    type: /^Debited$/i.test(rawType) ? "expense" : "income",
    amount,
    occurredAt,
    referenceNumber,
    payee,
    availableBalance,
    confidence: referenceNumber ? "high" : "medium",
  };
}

function parseUnionBankReviewEvent(message) {
  if (typeof message !== "string") {
    return null;
  }

  const text = normalizeSummary(message.replace(/(\d)(on\s+\d{2}-\d{2}-\d{4})/i, "$1 $2"));
  if (!isUnionBankLike(text)) {
    return null;
  }

  const lienMatch =
    /\blien\s+of\s+Rs\.?:?([\d,]+(?:\.\d{1,2})?).*?\bremoved\b.*?\baccount\s+\*+(\d{3,8})\s*on\s+(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/i.exec(
      text
    );

  if (lienMatch) {
    const amount = parseAmount(lienMatch[1]);
    const accountSuffix = normalizeAccountSuffix(lienMatch[2]);
    const occurredAt = parseUnionBankDate(lienMatch[3], lienMatch[4]);

    if (amount == null || !accountSuffix || !occurredAt) {
      return null;
    }

    return {
      bankName: "Union Bank of India",
      eventType: "lien_removed",
      amount,
      accountSuffix,
      occurredAt,
      summary: "Lien removed for general service charges",
      confidence: "medium",
    };
  }

  return null;
}

function parseBankNotification(message) {
  const transaction = parseUnionBankNotification(message);
  if (transaction) {
    return { kind: "transaction", parsed: transaction };
  }

  const event = parseUnionBankReviewEvent(message);
  if (event) {
    return { kind: "review_event", event };
  }

  return null;
}

function buildBankImportKey(parsed) {
  if (!parsed) {
    return null;
  }

  if (parsed.referenceNumber) {
    return `union-bank:ref:${parsed.referenceNumber}`;
  }

  return [
    "union-bank:fallback",
    parsed.accountSuffix,
    parsed.type,
    parsed.amount.toFixed(2),
    parsed.occurredAt,
    parsed.availableBalance.toFixed(2),
  ].join(":");
}

function buildBankReviewEventKey(event) {
  if (!event) {
    return null;
  }

  return [
    "union-bank:event",
    event.eventType,
    event.accountSuffix ?? "unknown",
    event.amount == null ? "unknown" : event.amount.toFixed(2),
    event.occurredAt ?? "unknown",
  ].join(":");
}

exports.parseUnionBankNotification = parseUnionBankNotification;
exports.parseUnionBankReviewEvent = parseUnionBankReviewEvent;
exports.parseBankNotification = parseBankNotification;
exports.buildBankImportKey = buildBankImportKey;
exports.buildBankReviewEventKey = buildBankReviewEventKey;
