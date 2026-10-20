import {
  clearQueuedBankReviewEvents,
  clearQueuedImports,
  clearQueuedRawBankCandidates,
  addBankImportQueuedListener,
  getNotificationAccessHealth,
  getQueuedBankReviewEvents,
  getQueuedImports,
  getQueuedRawBankCandidates,
  isNotificationAccessEnabled,
  openNotificationAccessSettings,
  type NotificationAccessHealth,
  type QueuedBankReviewEvent,
  type QueuedBankImport,
  type QueuedRawBankCandidate,
} from "expenser-bank-notifications";
import type { CreateTransactionPayload } from "./types";

export type NativeBankImport = QueuedBankImport;
export type NativeNotificationAccessHealth = NotificationAccessHealth;
export type NativeRawBankCandidate = QueuedRawBankCandidate;
export type NativeNotificationEnvelope = QueuedRawBankCandidate;
export type NativeBankReviewEvent = QueuedBankReviewEvent;
export { addBankImportQueuedListener };

export function getBankNotificationAccessEnabled() {
  return isNotificationAccessEnabled();
}

export function getBankNotificationAccessHealth(lookbackMs = 4 * 60 * 60 * 1000) {
  return getNotificationAccessHealth(lookbackMs);
}

export async function openBankNotificationAccessSettings() {
  await openNotificationAccessSettings();
}

export function getQueuedBankImports(): NativeBankImport[] {
  return getQueuedImports();
}

export function clearQueuedBankImports(sourceKeys: string[]) {
  clearQueuedImports(sourceKeys);
}

export function getQueuedRawBankImportCandidates(): NativeRawBankCandidate[] {
  return getQueuedRawBankCandidates();
}

export function clearQueuedRawBankImportCandidates(sourceKeys: string[]) {
  clearQueuedRawBankCandidates(sourceKeys);
}

export function getQueuedNativeBankReviewEvents(): NativeBankReviewEvent[] {
  return getQueuedBankReviewEvents();
}

export function getBankImportQueueSnapshot() {
  return {
    parsed: getQueuedImports().length,
    candidates: getQueuedRawBankCandidates().length,
    reviewEvents: getQueuedBankReviewEvents().length,
  };
}

export function clearQueuedNativeBankReviewEvents(sourceKeys: string[]) {
  clearQueuedBankReviewEvents(sourceKeys);
}

export function bankImportToTransactionPayload(
  item: NativeBankImport
): CreateTransactionPayload {
  return {
    type: item.type,
    amount: Number(item.amount),
    description: item.payee ?? "",
    category: "",
    paymentMethod: "bank",
    splitAmount: 0,
    date: item.occurredAt,
    importSource: item.importSource,
    importSourceKey: item.importSourceKey,
    importedAccountSuffix: item.accountSuffix,
    importedBankBalance:
      item.availableBalance == null ? undefined : Number(item.availableBalance),
    importedBankReference: item.referenceNumber ?? undefined,
    importedBankConfidence: item.confidence,
  };
}
