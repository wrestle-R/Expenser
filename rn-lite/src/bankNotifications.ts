import { NativeModules, Platform } from "react-native";
import type { QueuedBankImport, TransactionPayload } from "./types";

const nativeModule = NativeModules.ExpenserBankNotifications as
  | {
      isNotificationAccessEnabled: () => Promise<boolean>;
      openNotificationAccessSettings: () => Promise<boolean>;
      getQueuedImports: () => Promise<QueuedBankImport[]>;
      clearQueuedImports: (sourceKeys: string[]) => Promise<boolean>;
    }
  | undefined;

function ensureAndroidModule() {
  if (Platform.OS !== "android" || !nativeModule) {
    throw new Error("Bank notification import is available only in the Android Lite APK.");
  }
  return nativeModule;
}

export async function isNotificationAccessEnabled() {
  return ensureAndroidModule().isNotificationAccessEnabled();
}

export async function openNotificationAccessSettings() {
  return ensureAndroidModule().openNotificationAccessSettings();
}

export async function getQueuedImports() {
  return ensureAndroidModule().getQueuedImports();
}

export async function clearQueuedImports(sourceKeys: string[]) {
  return ensureAndroidModule().clearQueuedImports(sourceKeys);
}

export function toTransactionPayload(item: QueuedBankImport): TransactionPayload {
  const description =
    item.payee && item.payee.trim().length > 0
      ? `Union Bank UPI - ${item.payee.trim()}`
      : `Union Bank ${item.type === "expense" ? "debit" : "credit"}`;

  return {
    type: item.type,
    amount: item.amount,
    description,
    category: "other",
    paymentMethod: "bank",
    date: item.occurredAt,
    importSource: item.importSource,
    importSourceKey: item.importSourceKey,
    importedAccountSuffix: item.accountSuffix,
    importedBankBalance: item.availableBalance,
    importedBankReference: item.referenceNumber || undefined,
    importedBankConfidence: item.confidence,
  };
}
