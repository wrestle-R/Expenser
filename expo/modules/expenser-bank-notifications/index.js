import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

const NativeModule =
  Platform.OS === "android"
    ? requireNativeModule("ExpenserBankNotifications")
    : null;

export function isNotificationAccessEnabled() {
  return NativeModule?.isNotificationAccessEnabled?.() ?? false;
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
