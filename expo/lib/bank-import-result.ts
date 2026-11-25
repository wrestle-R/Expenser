import type { NativeRawBankCandidate } from "./bank-imports";
import type { BankReviewEvent, CreateTransactionPayload, ParsedBankNotificationResponse } from "./types";

export function parsedResponsePayload(
  response: Extract<ParsedBankNotificationResponse, { kind: "transaction" }>,
): CreateTransactionPayload {
  return {
    type: response.parsed.type,
    amount: response.parsed.amount,
    description: response.parsed.payee ?? "",
    category: "",
    paymentMethod: "bank",
    splitAmount: 0,
    date: response.parsed.occurredAt,
    importSource: response.importSource,
    importSourceKey: response.importSourceKey,
    importedAccountSuffix: response.parsed.accountSuffix ?? undefined,
    importedBankBalance: response.parsed.availableBalance ?? undefined,
    importedBankReference: response.parsed.referenceNumber ?? undefined,
    importedBankConfidence: response.parsed.confidence,
  };
}

export function parsedReviewEvent(
  response: Extract<ParsedBankNotificationResponse, { kind: "review_event" | "unparsed" }>,
  candidate: NativeRawBankCandidate,
): BankReviewEvent {
  const receipt = {
    capturedAt: candidate.capturedAt,
    notificationPackage: candidate.notificationPackage,
    parser: response.parser,
    rawMessage: candidate.message,
    sender: candidate.sender,
    sourcePackage: candidate.sourcePackage,
    sourceKey: candidate.sourceKey,
  };
  if (response.kind === "review_event") {
    return { ...response.event, ...receipt, importSource: response.importSource, importSourceKey: response.importSourceKey };
  }
  return {
    ...receipt,
    bankName: null,
    eventType: "unparsed_sms_notification",
    amount: null,
    accountSuffix: null,
    occurredAt: candidate.capturedAt,
    summary: "Transaction-like message needs review",
    confidence: "low",
    importSource: "sms_notification_review",
    importSourceKey: `sms:review:${candidate.sourceKey}`,
    failureReason: response.reason,
  };
}
