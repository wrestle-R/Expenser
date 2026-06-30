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

export type NotificationAccessHealth = {
  settingEnabled: boolean;
  recentReadCount: number;
  lastReadAt: string | null;
  hasRecentReads: boolean;
};

export type QueuedRawBankCandidate = {
  sourceKey: string;
  message: string;
  capturedAt: string;
  notificationPackage: string;
};

export type QueuedBankReviewEvent = {
  bankName: string;
  eventType: string;
  amount: number | null;
  accountSuffix: string | null;
  occurredAt: string | null;
  summary: string;
  confidence: "high" | "medium" | "low" | string;
  importSource: string;
  importSourceKey: string;
  capturedAt: string;
  notificationPackage: string;
};

export function isNotificationAccessEnabled(): boolean;
export function getNotificationAccessHealth(lookbackMs?: number): NotificationAccessHealth;
export function openNotificationAccessSettings(): Promise<void>;
export function getQueuedImports(): QueuedBankImport[];
export function clearQueuedImports(sourceKeys: string[]): void;
export function getQueuedRawBankCandidates(): QueuedRawBankCandidate[];
export function clearQueuedRawBankCandidates(sourceKeys: string[]): void;
export function getQueuedBankReviewEvents(): QueuedBankReviewEvent[];
export function clearQueuedBankReviewEvents(sourceKeys: string[]): void;
