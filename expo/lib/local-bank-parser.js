import {
  parseBankNotification,
  getNonTransactionReason,
  buildNotificationImportKey,
  buildNotificationReviewKey,
} from "expenser-bank-notifications/parser.js";

// This function never performs I/O. A null outcome is the only reason to use cloud parsing.
export function parseNotificationLocally(envelope) {
  const reason = getNonTransactionReason(envelope.message);
  if (reason) return { kind: "non_transaction", reason, parser: "regex" };
  const result = parseBankNotification(envelope.message, envelope);
  if (!result) return null;
  if (result.kind === "non_transaction") return { ...result, parser: "regex" };
  const transaction = result.kind === "transaction";
  return {
    ...result,
    parser: "regex",
    importSource: transaction ? "sms_notification" : "sms_notification_review",
    importSourceKey: transaction
      ? buildNotificationImportKey(result.parsed, envelope)
      : buildNotificationReviewKey(result.event, envelope),
  };
}
