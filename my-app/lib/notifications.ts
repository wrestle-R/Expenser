// Local notification service for sync reminders
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform, AppState, AppStateStatus } from "react-native";
import { getPendingTransactions, getPendingWorkflows, getPendingDeletes, getLastSyncTime } from "./storage";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private initialized = false;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private scheduledUnsyncedReminderId: string | null = null;
  private activeUnsyncedNotificationId: string | null = null;
  private activeStaleNotificationId: string | null = null;
  private lastUnsyncedCountNotified = 0;
  private lastStaleHoursNotified = -1;

  async initialize() {
    if (this.initialized) return;

    try {
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
        
        console.log("[Notifications] Permission granted:", finalStatus);
      } else {
        console.log("[Notifications] Running on simulator/emulator - notifications may not work");
      }

      // Android notification channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("sync-reminders", {
          name: "Sync Reminders",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#f59e0b",
          sound: "default",
        });
        console.log("[Notifications] Android channel created");
      }

      this.initialized = true;
      console.log("[Notifications] Initialized successfully");

      // Listen for app state changes to check when app comes to foreground
      this.appStateSubscription = AppState.addEventListener("change", this.handleAppStateChange);

      // Start periodic check (every 30 minutes while app is open)
      this.startPeriodicCheck();
      
      // Schedule a delayed notification check for when the app goes to background
      await this.scheduleBackgroundReminder();
    } catch (error) {
      console.error("[Notifications] Error initializing:", error);
    }
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === "active") {
      // App came to foreground - check and notify
      console.log("[Notifications] App came to foreground, checking...");
      await this.checkAndNotify();
    } else if (nextAppState === "background") {
      // App went to background - schedule future notification
      console.log("[Notifications] App went to background, scheduling reminder...");
      await this.scheduleBackgroundReminder();
    }
  };

  // Schedule a notification to fire later when the app is in background
  private async scheduleBackgroundReminder() {
    try {
      // Cancel any existing scheduled reminder first.
      if (this.scheduledUnsyncedReminderId) {
        await Notifications.cancelScheduledNotificationAsync(this.scheduledUnsyncedReminderId).catch(() => {});
        this.scheduledUnsyncedReminderId = null;
      }
      
      // Check if there's pending data to sync
      const [pendingTxns, pendingWorkflows, pendingDeletes] = await Promise.all([
        getPendingTransactions(),
        getPendingWorkflows(),
        getPendingDeletes(),
      ]);
      
      const totalPending = pendingTxns.length + pendingWorkflows.length + pendingDeletes.length;
      
      if (totalPending > 0) {
        // Schedule a notification to remind user about unsynced data in 1 hour
        this.scheduledUnsyncedReminderId = await Notifications.scheduleNotificationAsync({
          content: {
            title: "Don't forget to sync!",
            body: `You have ${totalPending} item${totalPending > 1 ? "s" : ""} waiting to sync. Open Expenser to upload your changes.`,
            data: { type: "unsynced-reminder" },
            sound: true,
            ...(Platform.OS === "android" && { channelId: "sync-reminders" }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 60 * 60, // 1 hour
          },
        });
        console.log("[Notifications] Scheduled background reminder for 1 hour");
      }
    } catch (error) {
      console.error("[Notifications] Error scheduling background reminder:", error);
    }
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
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.scheduledUnsyncedReminderId = null;
    this.activeUnsyncedNotificationId = null;
    this.activeStaleNotificationId = null;
    this.lastUnsyncedCountNotified = 0;
    this.lastStaleHoursNotified = -1;
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
      if (this.lastUnsyncedCountNotified === totalPending && this.activeUnsyncedNotificationId) {
        return;
      }

      if (this.activeUnsyncedNotificationId) {
        await Notifications.dismissNotificationAsync(this.activeUnsyncedNotificationId).catch(() => {});
      }

      const itemWord = totalPending === 1 ? "item" : "items";
      this.activeUnsyncedNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Unsynced Data",
          body: `You have ${totalPending} ${itemWord} waiting to sync. Connect to the internet to upload your changes.`,
          data: { type: "unsynced" },
          ...(Platform.OS === "android" && { channelId: "sync-reminders" }),
        },
        trigger: null, // Show immediately
      });
      this.lastUnsyncedCountNotified = totalPending;
      console.log(`[Notifications] Sent unsynced data notification (${totalPending} items)`);
    } else {
      // Clear the notification if everything is synced
      if (this.activeUnsyncedNotificationId) {
        await Notifications.dismissNotificationAsync(this.activeUnsyncedNotificationId).catch(() => {});
        this.activeUnsyncedNotificationId = null;
      }
      this.lastUnsyncedCountNotified = 0;
    }
  }

  /**
   * Notification 2: Stale data reminder
   * Fires when the app hasn't successfully refreshed from the server in 4+ hours.
   */
  private async checkStaleData() {
    const lastSync = await getLastSyncTime();

    if (!lastSync) {
      if (this.activeStaleNotificationId) {
        return;
      }

      // Never synced — notify once
      this.activeStaleNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Data May Be Outdated",
          body: "Your data hasn't been refreshed yet. Open the app with internet to get the latest data.",
          data: { type: "stale" },
          ...(Platform.OS === "android" && { channelId: "sync-reminders" }),
        },
        trigger: null,
      });
      this.lastStaleHoursNotified = 0;
      console.log("[Notifications] Sent stale data notification (never synced)");
      return;
    }

    const timeSinceSync = Date.now() - lastSync;
    if (timeSinceSync >= FOUR_HOURS_MS) {
      const hours = Math.floor(timeSinceSync / (60 * 60 * 1000));
      if (hours <= this.lastStaleHoursNotified && this.activeStaleNotificationId) {
        return;
      }

      if (this.activeStaleNotificationId) {
        await Notifications.dismissNotificationAsync(this.activeStaleNotificationId).catch(() => {});
      }

      this.activeStaleNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Data May Be Outdated",
          body: `Your data hasn't been refreshed in ${hours}+ hours. Open the app to sync.`,
          data: { type: "stale" },
          ...(Platform.OS === "android" && { channelId: "sync-reminders" }),
        },
        trigger: null,
      });
      this.lastStaleHoursNotified = hours;
      console.log(`[Notifications] Sent stale data notification (${hours}h ago)`);
    } else {
      // Data is fresh — clear the notification
      if (this.activeStaleNotificationId) {
        await Notifications.dismissNotificationAsync(this.activeStaleNotificationId).catch(() => {});
        this.activeStaleNotificationId = null;
      }
      this.lastStaleHoursNotified = -1;
    }
  }

  /**
   * Called after a successful sync to clear the unsynced notification
   * and update the stale check.
   */
  async onSyncComplete() {
    try {
      if (this.scheduledUnsyncedReminderId) {
        await Notifications.cancelScheduledNotificationAsync(this.scheduledUnsyncedReminderId).catch(() => {});
        this.scheduledUnsyncedReminderId = null;
      }

      if (this.activeUnsyncedNotificationId) {
        await Notifications.dismissNotificationAsync(this.activeUnsyncedNotificationId).catch(() => {});
        this.activeUnsyncedNotificationId = null;
      }

      if (this.activeStaleNotificationId) {
        await Notifications.dismissNotificationAsync(this.activeStaleNotificationId).catch(() => {});
        this.activeStaleNotificationId = null;
      }

      this.lastUnsyncedCountNotified = 0;
      this.lastStaleHoursNotified = -1;
    } catch {
      // Ignore
    }
  }

  /**
   * Called when a new pending item is added while offline
   */
  async onPendingItemAdded(pendingCount: number) {
    if (!this.initialized || pendingCount === 0) return;

    try {
      // Force a refreshed unsynced message and schedule background reminder.
      this.lastUnsyncedCountNotified = 0;
      await this.checkUnsyncedData();
      await this.scheduleBackgroundReminder();
      console.log(`[Notifications] Pending item added (${pendingCount} items)`);
    } catch (error) {
      console.error("[Notifications] Error sending pending notification:", error);
    }
  }

  /**
   * Send a test notification (for debugging)
   */
  async sendTestNotification() {
    if (!this.initialized) {
      console.log("[Notifications] Not initialized, cannot send test");
      return;
    }
    
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Test Notification",
          body: "Notifications are working correctly!",
          sound: true,
          ...(Platform.OS === "android" && { channelId: "sync-reminders" }),
        },
        trigger: null,
      });
      console.log("[Notifications] Test notification sent");
    } catch (error) {
      console.error("[Notifications] Error sending test:", error);
    }
  }
}

export const notificationService = new NotificationService();
