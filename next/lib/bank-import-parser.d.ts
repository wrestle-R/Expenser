export type ParseContext = {
  capturedAt?: string | null;
  sender?: string | null;
  sourcePackage?: string | null;
  sourceKey?: string | null;
};

export type ParsedFinancialNotification = {
  bankName: string | null;
  accountSuffix: string | null;
  type: "income" | "expense";
  amount: number;
  currency: "INR";
  occurredAt: string;
  referenceNumber: string | null;
  payee: string | null;
  availableBalance: number | null;
  confidence: "high" | "medium";
};

export type ParsedBankReviewEvent = {
  bankName: string | null;
  eventType: string;
  amount: number | null;
  accountSuffix: string | null;
  occurredAt: string | null;
  summary: string;
  confidence: "high" | "medium" | "low";
};

export type ParsedBankNotificationResult =
  | { kind: "transaction"; parsed: ParsedFinancialNotification }
  | { kind: "review_event"; event: ParsedBankReviewEvent }
  | { kind: "non_transaction"; reason: string };

export function normalizeBankMessage(value: unknown): string;
export function isFinancialNotificationLike(message: string): boolean;
export function isUnionBankLike(message: string): boolean;
export function getNonTransactionReason(message: string): string | null;
export function parseFinancialTransaction(
  message: string,
  context?: ParseContext
): ParsedFinancialNotification | null;
export function parseFinancialReviewEvent(
  message: string,
  context?: ParseContext
): ParsedBankReviewEvent | null;
export function parseUnionBankNotification(
  message: string,
  context?: ParseContext
): ParsedFinancialNotification | null;
export function parseUnionBankReviewEvent(
  message: string,
  context?: ParseContext
): ParsedBankReviewEvent | null;
export function parseBankNotification(
  message: string,
  context?: ParseContext
): ParsedBankNotificationResult | null;
export function hashNormalizedBankMessage(message: string): string;
export function buildBankImportKey(
  parsed: ParsedFinancialNotification | null,
  message?: string
): string | null;
export function buildBankReviewEventKey(
  event: ParsedBankReviewEvent | null,
  message?: string
): string | null;
export function buildNotificationImportKey(
  parsed: ParsedFinancialNotification | null,
  envelope?: ParseContext & { message?: string | null }
): string | null;
export function buildNotificationReviewKey(
  event: ParsedBankReviewEvent | null,
  envelope?: ParseContext & { message?: string | null }
): string | null;

export type ParsedUnionBankNotification = ParsedFinancialNotification;
