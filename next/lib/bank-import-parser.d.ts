export type ParsedUnionBankNotification = {
  bankName: "Union Bank of India";
  accountSuffix: string;
  type: "income" | "expense";
  amount: number;
  occurredAt: string;
  referenceNumber: string | null;
  payee: string | null;
  availableBalance: number;
  confidence: "high" | "medium";
};

export function parseUnionBankNotification(
  message: unknown
): ParsedUnionBankNotification | null;

export function buildBankImportKey(
  parsed: ParsedUnionBankNotification | null
): string | null;
