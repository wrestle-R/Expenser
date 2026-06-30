import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

const NativeModule =
  Platform.OS === "android"
    ? requireNativeModule("ExpenserBankNotifications")
    : null;

export function isNotificationAccessEnabled() {
  return NativeModule?.isNotificationAccessEnabled?.() ?? false;
}

export function getNotificationAccessHealth(lookbackMs) {
  return NativeModule?.getNotificationAccessHealth?.(lookbackMs) ?? {
    settingEnabled: false,
    recentReadCount: 0,
    lastReadAt: null,
    hasRecentReads: false,
  };
}

export async function openNotificationAccessSettings() {
  if (!NativeModule) {
    return;
  }
  await NativeModule.openNotificationAccessSettings();
}

export function getQueuedImports() {
  return NativeModule?.getQueuedImports?.() ?? [];
}

export function clearQueuedImports(sourceKeys) {
  NativeModule?.clearQueuedImports?.(sourceKeys);
}

export function getQueuedRawBankCandidates() {
  return NativeModule?.getQueuedRawBankCandidates?.() ?? [];
}

export function clearQueuedRawBankCandidates(sourceKeys) {
  NativeModule?.clearQueuedRawBankCandidates?.(sourceKeys);
}

export function getQueuedBankReviewEvents() {
  return NativeModule?.getQueuedBankReviewEvents?.() ?? [];
}

export function clearQueuedBankReviewEvents(sourceKeys) {
  NativeModule?.clearQueuedBankReviewEvents?.(sourceKeys);
}
