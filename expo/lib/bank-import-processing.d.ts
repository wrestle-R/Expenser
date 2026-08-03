import type {
  NotificationEnvelope,
  ParsedBankNotificationResponse,
} from "./types";

export function processBankImportCandidate(input: {
  candidate: NotificationEnvelope;
  parse: (candidate: NotificationEnvelope) => Promise<ParsedBankNotificationResponse>;
  queueTransaction: (
    response: Extract<ParsedBankNotificationResponse, { kind: "transaction" }>
  ) => Promise<void>;
  saveReview: (
    response: Extract<ParsedBankNotificationResponse, { kind: "review_event" | "unparsed" }>,
    candidate: NotificationEnvelope
  ) => Promise<boolean>;
}): Promise<ParsedBankNotificationResponse["kind"]>;
