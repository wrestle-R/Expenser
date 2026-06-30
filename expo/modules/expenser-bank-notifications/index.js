import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

let nativeModule;
let didResolveNativeModule = false;

function getNativeModule() {
  if (Platform.OS !== "android") {
    return null;
  }

  if (!didResolveNativeModule) {
    didResolveNativeModule = true;

    try {
      nativeModule = requireNativeModule("ExpenserBankNotifications");
    } catch {
      nativeModule = null;
    }
  }

  return nativeModule;
}

export function isNotificationAccessEnabled() {
  return getNativeModule()?.isNotificationAccessEnabled?.() ?? false;
}

export function getNotificationAccessHealth(lookbackMs) {
  return getNativeModule()?.getNotificationAccessHealth?.(lookbackMs) ?? {
    settingEnabled: false,
    recentReadCount: 0,
    lastReadAt: null,
    hasRecentReads: false,
  };
}

export async function openNotificationAccessSettings() {
  const module = getNativeModule();

  if (!module) {
    return;
  }

  await module.openNotificationAccessSettings();
}

export function getQueuedImports() {
  return getNativeModule()?.getQueuedImports?.() ?? [];
}

export function clearQueuedImports(sourceKeys) {
  getNativeModule()?.clearQueuedImports?.(sourceKeys);
}

export function getQueuedRawBankCandidates() {
  return getNativeModule()?.getQueuedRawBankCandidates?.() ?? [];
}

export function clearQueuedRawBankCandidates(sourceKeys) {
  getNativeModule()?.clearQueuedRawBankCandidates?.(sourceKeys);
}

export function getQueuedBankReviewEvents() {
  return getNativeModule()?.getQueuedBankReviewEvents?.() ?? [];
}

export function clearQueuedBankReviewEvents(sourceKeys) {
  getNativeModule()?.clearQueuedBankReviewEvents?.(sourceKeys);
}
