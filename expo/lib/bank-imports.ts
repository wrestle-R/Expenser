import {
  clearQueuedImports,
  getQueuedImports,
  isNotificationAccessEnabled,
  openNotificationAccessSettings,
  type QueuedBankImport,
} from "expenser-bank-notifications";
import type { CreateTransactionPayload } from "./types";

export type NativeBankImport = QueuedBankImport;

export function getBankNotificationAccessEnabled() {
  return isNotificationAccessEnabled();
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

export function bankImportToTransactionPayload(
  item: NativeBankImport
): CreateTransactionPayload {
  return {
    type: item.type,
    amount: Number(item.amount),
    description: "",
    category: "",
    paymentMethod: "bank",
    splitAmount: 0,
    date: item.occurredAt,
    importSource: item.importSource,
    importSourceKey: item.importSourceKey,
    importedAccountSuffix: item.accountSuffix,
    importedBankBalance: Number(item.availableBalance),
    importedBankReference: item.referenceNumber ?? undefined,
    importedBankConfidence: item.confidence,
  };
}
