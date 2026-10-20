import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import { Platform } from "react-native";

const CHANNEL_ID = "transaction-imports";
const NOTIFIED_KEYS = "@expenser_notified_bank_imports_v1";
const MAX_NOTIFIED_KEYS = 250;

type NotificationsModule = typeof import("expo-notifications");

class NotificationService {
  private initialized = false;
  private notifications: NotificationsModule | null | undefined;

  private async getNotifications() {
    if (this.notifications !== undefined) return this.notifications;

    try {
      const notifications = await import("expo-notifications");
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      this.notifications = notifications;
    } catch (error) {
      console.warn("[Notifications] Unavailable in this runtime:", error);
      this.notifications = null;
    }

    return this.notifications;
  }

  async initialize() {
    if (this.initialized) return;
    const Notifications = await this.getNotifications();
    if (!Notifications) return;

    if (Device.isDevice) {
      const existing = await Notifications.getPermissionsAsync();
      const permission =
        existing.status === "granted"
          ? existing
          : await Notifications.requestPermissionsAsync();
      if (permission.status !== "granted") return;
    }

    if (Platform.OS === "android") {
      await Notifications.deleteNotificationChannelAsync("sync-reminders").catch(() => {});
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Imported transactions",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: "default",
      });
    }

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) =>
          ["unsynced-reminder", "unsynced", "stale"].includes(
            String(item.content.data?.type ?? "")
          )
        )
        .map((item) =>
          Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => {})
        )
    );
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((item) =>
          ["unsynced-reminder", "unsynced", "stale"].includes(
            String(item.request.content.data?.type ?? "")
          )
        )
        .map((item) =>
          Notifications.dismissNotificationAsync(item.request.identifier).catch(() => {})
        )
    );
    this.initialized = true;
  }

  async notifyImportedTransaction(input: {
    importSourceKey: string;
    amount: number;
    type: "income" | "expense";
    stealthMode: boolean;
  }) {
    await this.initialize();
    const Notifications = await this.getNotifications();
    if (!Notifications || !this.initialized) return;

    const rawKeys = await AsyncStorage.getItem(NOTIFIED_KEYS);
    const keys: string[] = rawKeys ? JSON.parse(rawKeys) : [];
    if (keys.includes(input.importSourceKey)) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Transaction added",
        body: input.stealthMode
          ? "A bank transaction was added to Expenser."
          : `${input.type === "income" ? "Received" : "Spent"} ₹${input.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}. Choose a category if needed.`,
        data: { type: "transaction-imported", importSourceKey: input.importSourceKey },
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null,
    });

    await AsyncStorage.setItem(
      NOTIFIED_KEYS,
      JSON.stringify([input.importSourceKey, ...keys].slice(0, MAX_NOTIFIED_KEYS))
    );
  }

  cleanup() {}
}

export const notificationService = new NotificationService();
