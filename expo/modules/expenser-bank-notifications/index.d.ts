export type QueuedBankImport = {
  bankName: string;
  accountSuffix: string;
  type: "income" | "expense";
  amount: number;
  occurredAt: string;
  referenceNumber: string | null;
  payee: string | null;
  availableBalance: number;
  confidence: "high" | "medium";
  importSource: string;
  importSourceKey: string;
  capturedAt: string;
  notificationPackage: string;
};

export function isNotificationAccessEnabled(): boolean;
export function openNotificationAccessSettings(): Promise<void>;
export function getQueuedImports(): QueuedBankImport[];
export function clearQueuedImports(sourceKeys: string[]): void;
