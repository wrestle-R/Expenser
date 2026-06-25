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
  const [hours, minutes, seconds] = timePart.split(":").map(Number);
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
    .replace(/[.,\s]+$/g, "")
    .trim();

  return cleaned || null;
}

function parseUnionBankNotification(message) {
  if (typeof message !== "string") {
    return null;
  }

  const text = message.replace(/\s+/g, " ").trim();
  if (!/Union Bank of India/i.test(text) && !/\bA\/c\s+\*\d{3,6}\b/i.test(text)) {
    return null;
  }

  const coreMatch =
    /\bA\/c\s+\*(\d{3,6})\s+(Debited|Credited(?:\s+for)?)\s+Rs:?([\d,]+(?:\.\d{1,2})?)\s+on\s+(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2}:\d{2})/i.exec(
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

  if (amount == null || availableBalance == null || !occurredAt) {
    return null;
  }

  const refMatch = /\bref\s+no\s+(\d{6,})\b/i.exec(text);
  const payeeMatch = /\bFvg:\s*(.*?)(?:\s+Avl\s+Bal\b|$)/i.exec(text);
  const referenceNumber = refMatch?.[1]?.trim() || null;

  return {
    bankName: "Union Bank of India",
    accountSuffix,
    type: /^Debited$/i.test(rawType) ? "expense" : "income",
    amount,
    occurredAt,
    referenceNumber,
    payee: normalizePayee(payeeMatch?.[1]),
    availableBalance,
    confidence: referenceNumber ? "high" : "medium",
  };
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

exports.parseUnionBankNotification = parseUnionBankNotification;
exports.buildBankImportKey = buildBankImportKey;
