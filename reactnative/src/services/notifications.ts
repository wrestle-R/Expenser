// Notification service stub for RN CLI
// Matches the interface of the Expo notification service but is a no-op.
// Can be replaced with @notifee/react-native for full push notification support.

class NotificationService {
  private initialized = false;

  async initialize() {
    this.initialized = true;
    console.log('[Notifications] Stub initialized (no-op in RN CLI)');
  }

  cleanup() {
    this.initialized = false;
  }

  async checkAndNotify() {
    // No-op
  }

  async onSyncComplete() {
    // No-op
  }

  async onPendingItemAdded(_pendingCount: number) {
    // No-op
  }

  async sendTestNotification() {
    console.log('[Notifications] Test notification (no-op)');
  }
}

export const notificationService = new NotificationService();
