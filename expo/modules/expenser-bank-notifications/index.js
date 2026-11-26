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
    defaultSmsPackage: null,
    queuedCandidateCount: 0,
    queuedReviewEventCount: 0,
    legacyParsedCount: 0,
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
  return !isBankImportEnabled() ? [] : getNativeModule()?.getQueuedImports?.() ?? [];
}

export function clearQueuedImports(sourceKeys) {
  getNativeModule()?.clearQueuedImports?.(sourceKeys);
}

export function setBankImportOwner(owner) {
  getNativeModule()?.setBankImportOwner?.(owner);
}

export function getQueuedRawBankCandidates(owner = null, unattendedOnly = false) {
  return !isBankImportEnabled() ? [] : getNativeModule()?.getQueuedRawBankCandidates?.(owner, unattendedOnly) ?? [];
}

export function markRawBankCandidateForReview(sourceKey) {
  getNativeModule()?.markRawBankCandidateForReview?.(sourceKey);
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

export function addBankImportQueuedListener(listener) {
  const module = getNativeModule();
  return module?.addListener?.("onBankImportQueued", listener) ?? { remove() {} };
}

export function isBankImportEnabled() { return getNativeModule()?.isBankImportEnabled?.() ?? true; }
export function setBankImportEnabled(enabled) { getNativeModule()?.setBankImportEnabled?.(enabled); }
export async function scanRecentSms() { return await getNativeModule()?.scanRecentSms?.() ?? 0; }

export function setRecentWidgetTransactions(titles, amounts) {
  getNativeModule()?.setRecentWidgetTransactions?.(titles, amounts);
}

export async function pinRecentTransactionsWidget() {
  return await getNativeModule()?.pinRecentTransactionsWidget?.() ?? false;
}

export async function downloadAndroidUpdate(version, code, digest) {
  const module = getNativeModule();
  if (!module?.downloadAndroidUpdate) throw new Error("Android update download is unavailable");
  await module.downloadAndroidUpdate(version, code, digest);
}

export async function installAndroidUpdate(code, digest) {
  return await getNativeModule()?.installAndroidUpdate?.(code, digest) ?? "missing";
}
