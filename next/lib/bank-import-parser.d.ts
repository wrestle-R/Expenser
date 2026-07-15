export type ParsedUnionBankNotification = {
  bankName: "Union Bank of India";
  accountSuffix: string;
  type: "income" | "expense";
  amount: number;
  occurredAt: string;
  referenceNumber: string | null;
  payee: string | null;
  availableBalance: number | null;
  confidence: "high" | "medium";
};

export type ParsedBankReviewEvent = {
  bankName: "Union Bank of India";
  eventType: string;
  amount: number | null;
  accountSuffix: string | null;
  occurredAt: string | null;
  summary: string;
  confidence: "high" | "medium" | "low";
};

export type ParsedBankNotificationResult =
  | {
      kind: "transaction";
      parsed: ParsedUnionBankNotification;
    }
  | {
      kind: "review_event";
      event: ParsedBankReviewEvent;
    };

export function parseUnionBankNotification(
  message: unknown
): ParsedUnionBankNotification | null;

export function parseUnionBankReviewEvent(
  message: unknown
): ParsedBankReviewEvent | null;

export function parseBankNotification(
  message: unknown
): ParsedBankNotificationResult | null;

export function normalizeBankMessage(message: unknown): string;
export function hashNormalizedBankMessage(message: unknown): string;
export function isUnionBankLike(message: unknown): boolean;

export function buildBankImportKey(
  parsed: ParsedUnionBankNotification | null,
  message?: string
): string | null;

export function buildBankReviewEventKey(
  event: ParsedBankReviewEvent | null,
  message?: string
): string | null;
