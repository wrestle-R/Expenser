// Local notification service for sync reminders
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { getPendingTransactions, getPendingWorkflows, getPendingDeletes, getLastSyncTime } from "./storage";

// Notification IDs for deduplication
const NOTIF_ID_UNSYNCED = "expenser-unsynced-data";
const NOTIF_ID_STALE = "expenser-stale-data";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private initialized = false;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  async initialize() {
    if (this.initialized) return;

    // Request permissions
    if (Device.isDevice) {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("[Notifications] Permission not granted");
        return;
      }
    }

    // Android notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("sync-reminders", {
        name: "Sync Reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: "#f59e0b",
      });
    }

    this.initialized = true;
    console.log("[Notifications] Initialized");

    // Start periodic check (every 30 minutes)
    this.startPeriodicCheck();
  }

  private startPeriodicCheck() {
    // Check immediately on init
    this.checkAndNotify();

    // Then every 30 minutes
    this.checkInterval = setInterval(() => {
      this.checkAndNotify();
    }, 30 * 60 * 1000);
  }

  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check for unsynced data and stale data, fire notifications as needed.
   */
  async checkAndNotify() {
    if (!this.initialized) return;

    try {
      await Promise.all([
        this.checkUnsyncedData(),
        this.checkStaleData(),
      ]);
    } catch (error) {
      console.error("[Notifications] Error checking:", error);
    }
  }

  /**
   * Notification 1: Unsynced data reminder
   * Fires when there are pending transactions/workflows/deletes that haven't been synced.
   */
  private async checkUnsyncedData() {
    const [pendingTxns, pendingWorkflows, pendingDeletes] = await Promise.all([
      getPendingTransactions(),
      getPendingWorkflows(),
      getPendingDeletes(),
    ]);

    const totalPending = pendingTxns.length + pendingWorkflows.length + pendingDeletes.length;

    if (totalPending > 0) {
      const itemWord = totalPending === 1 ? "item" : "items";
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIF_ID_UNSYNCED,
        content: {
          title: "Unsynced Data",
          body: `You have ${totalPending} ${itemWord} waiting to sync. Connect to the internet to upload your changes.`,
          data: { type: "unsynced" },
          ...(Platform.OS === "android" && { channelId: "sync-reminders" }),
        },
        trigger: null, // Show immediately
      });
      console.log(`[Notifications] Sent unsynced data notification (${totalPending} items)`);
    } else {
      // Clear the notification if everything is synced
      await Notifications.dismissNotificationAsync(NOTIF_ID_UNSYNCED);
    }
  }

  /**
   * Notification 2: Stale data reminder
   * Fires when the app hasn't successfully refreshed from the server in 4+ hours.
   */
  private async checkStaleData() {
    const lastSync = await getLastSyncTime();

    if (!lastSync) {
      // Never synced — notify
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIF_ID_STALE,
        content: {
          title: "Data May Be Outdated",
          body: "Your data hasn't been refreshed yet. Open the app with internet to get the latest data.",
          data: { type: "stale" },
          ...(Platform.OS === "android" && { channelId: "sync-reminders" }),
        },
        trigger: null,
      });
      console.log("[Notifications] Sent stale data notification (never synced)");
      return;
    }

    const timeSinceSync = Date.now() - lastSync;
    if (timeSinceSync >= FOUR_HOURS_MS) {
      const hours = Math.floor(timeSinceSync / (60 * 60 * 1000));
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIF_ID_STALE,
        content: {
          title: "Data May Be Outdated",
          body: `Your data hasn't been refreshed in ${hours}+ hours. Open the app to sync.`,
          data: { type: "stale" },
          ...(Platform.OS === "android" && { channelId: "sync-reminders" }),
        },
        trigger: null,
      });
      console.log(`[Notifications] Sent stale data notification (${hours}h ago)`);
    } else {
      // Data is fresh — clear the notification
      await Notifications.dismissNotificationAsync(NOTIF_ID_STALE);
    }
  }

  /**
   * Called after a successful sync to clear the unsynced notification
   * and update the stale check.
   */
  async onSyncComplete() {
    try {
      await Notifications.dismissNotificationAsync(NOTIF_ID_UNSYNCED);
      await Notifications.dismissNotificationAsync(NOTIF_ID_STALE);
    } catch {
      // Ignore
    }
  }

  /**
   * Called when a new pending item is added while offline
   */
  async onPendingItemAdded(pendingCount: number) {
    if (!this.initialized || pendingCount === 0) return;

    const itemWord = pendingCount === 1 ? "item" : "items";
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIF_ID_UNSYNCED,
        content: {
          title: "Unsynced Data",
          body: `You have ${pendingCount} ${itemWord} waiting to sync. Connect to the internet to upload your changes.`,
          data: { type: "unsynced" },
          ...(Platform.OS === "android" && { channelId: "sync-reminders" }),
        },
        trigger: null,
      });
    } catch {
      // Ignore
    }
  }
}

export const notificationService = new NotificationService();
