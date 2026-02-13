// Sync service for handling offline/online synchronization
import NetInfo from "@react-native-community/netinfo";
import { api } from "./api";
import {
  getStoredTransactions,
  setStoredTransactions,
  getPendingTransactions,
  clearPendingTransactions,
  removePendingTransaction,
  getStoredWorkflows,
  setStoredWorkflows,
  getPendingWorkflows,
  clearPendingWorkflows,
  removePendingWorkflow,
  getPendingDeletes,
  clearPendingDeletes,
  getStoredProfile,
  setStoredProfile,
  setLastSyncTime,
  getLocalBalances,
  setLocalBalances,
} from "./storage";
import { ITransaction, IWorkflow, IUserProfile } from "./types";
import { notificationService } from "./notifications";

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
}

const AUTO_REFRESH_INTERVAL = 3000; // 3 seconds

class SyncService {
  private isSyncing = false;
  private listeners: ((status: SyncStatus) => void)[] = [];
  private unsubscribeNetInfo: (() => void) | null = null;
  private autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private _isOnline = false;

  async initialize() {
    // Listen for network state changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const wasOffline = !this._isOnline;
      this._isOnline = state.isConnected ?? false;

      if (state.isConnected && wasOffline) {
        console.log("[Sync] Network connected, triggering sync...");
        this.syncAll();
      }

      // Notify listeners about connectivity change
      this.notifyListeners();

      // Start/stop auto-refresh based on connectivity
      if (state.isConnected) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });

    // Check current network state and sync if online
    const state = await NetInfo.fetch();
    this._isOnline = state.isConnected ?? false;
    if (state.isConnected) {
      this.syncAll();
      this.startAutoRefresh();
    }
  }

  private startAutoRefresh() {
    if (this.autoRefreshTimer) return; // Already running
    console.log("[Sync] Starting auto-refresh every 3s");
    this.autoRefreshTimer = setInterval(() => {
      if (this._isOnline && !this.isSyncing) {
        this.silentRefresh();
      }
    }, AUTO_REFRESH_INTERVAL);
  }

  private stopAutoRefresh() {
    if (this.autoRefreshTimer) {
      console.log("[Sync] Stopping auto-refresh");
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  // Light refresh - just fetch latest data without full sync
  private async silentRefresh() {
    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) return;

      // Check for pending items FIRST
      const pendingTxns = await getPendingTransactions();
      const pendingWorkflows = await getPendingWorkflows();
      const pendingDeletes = await getPendingDeletes();
      const hasPendingItems = pendingTxns.length > 0 || pendingWorkflows.length > 0 || pendingDeletes.length > 0;

      // Only fetch, don't sync pending (that happens in syncAll)
      const [transactions, workflows, profile] = await Promise.all([
        api.getTransactions().catch(() => null),
        api.getWorkflows().catch(() => null),
        api.getProfile().catch(() => null),
      ]);

      if (transactions) await setStoredTransactions(transactions);
      if (workflows) await setStoredWorkflows(workflows);
      if (profile) {
        await setStoredProfile(profile);
        // ONLY update local balances from server if there are NO pending transactions
        // Otherwise we would overwrite the user's local balance changes
        if (!hasPendingItems) {
          await setLocalBalances(profile.balances);
        }
      }

      // Trigger full sync if there are pending items
      if (hasPendingItems) {
        this.syncAll(); // Full sync if there are pending items
      }

      this.notifyListeners();
    } catch (error) {
      // Silent fail - this is background refresh
    }
  }

  cleanup() {
    this.stopAutoRefresh();
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }

  subscribe(listener: (status: SyncStatus) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private async notifyListeners() {
    const status = await this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  async getStatus(): Promise<SyncStatus> {
    const pendingTxns = await getPendingTransactions();
    const pendingWorkflows = await getPendingWorkflows();
    const pendingDeletes = await getPendingDeletes();

    return {
      isOnline: this._isOnline,
      isSyncing: this.isSyncing,
      pendingCount:
        pendingTxns.length + pendingWorkflows.length + pendingDeletes.length,
      lastSyncTime: null,
    };
  }

  async isOnline(): Promise<boolean> {
    // Use cached value first for speed, but verify with NetInfo
    try {
      const state = await NetInfo.fetch();
      this._isOnline = state.isConnected ?? false;
    } catch {
      // Use cached value
    }
    return this._isOnline;
  }

  // Quick sync check without network call
  isOnlineSync(): boolean {
    return this._isOnline;
  }

  // Force a manual refresh - fetches everything fresh
  async forceRefresh(): Promise<{
    transactions: ITransaction[];
    workflows: IWorkflow[];
    profile: IUserProfile | null;
  } | null> {
    const online = await this.isOnline();
    if (!online) return null;

    try {
      // Sync pending items first
      await this.syncAll();
      
      // Then fetch fresh data
      return await this.fetchAllFromServer();
    } catch (error) {
      console.error("[Sync] Force refresh failed:", error);
      return null;
    }
  }

  async syncAll() {
    if (this.isSyncing) {
      console.log("[Sync] Already syncing, skipping...");
      return;
    }

    const isOnline = await this.isOnline();
    if (!isOnline) {
      console.log("[Sync] Offline, skipping sync...");
      return;
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      console.log("[Sync] Starting full sync...");

      // 1. Sync pending deletes first
      await this.syncPendingDeletes();

      // 2. Sync pending transactions
      await this.syncPendingTransactions();

      // 3. Sync pending workflows
      await this.syncPendingWorkflows();

      // 4. Fetch fresh data from server
      await this.fetchAllFromServer();

      // Update last sync time
      await setLastSyncTime(Date.now());

      // Clear unsynced/stale notifications on successful sync
      await notificationService.onSyncComplete();

      console.log("[Sync] Sync completed successfully");
    } catch (error) {
      console.error("[Sync] Error during sync:", error);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  private async syncPendingDeletes() {
    const pendingDeletes = await getPendingDeletes();
    console.log("[Sync] Syncing", pendingDeletes.length, "pending deletes");

    for (const item of pendingDeletes) {
      try {
        if (item.type === "transaction") {
          await api.deleteTransaction(item.id);
        } else if (item.type === "workflow") {
          await api.deleteWorkflow(item.id);
        }
      } catch (error) {
        console.error("[Sync] Error deleting item:", item, error);
      }
    }

    await clearPendingDeletes();
  }

  private async syncPendingTransactions() {
    const pending = await getPendingTransactions();
    console.log("[Sync] Syncing", pending.length, "pending transactions");

    for (const txn of pending) {
      try {
        await api.createTransaction({
          type: txn.type,
          amount: txn.amount,
          description: txn.description,
          category: txn.category,
          paymentMethod: txn.paymentMethod,
          splitAmount: txn.splitAmount,
          date: txn.date,
        });
        await removePendingTransaction(txn._id);
      } catch (error) {
        console.error("[Sync] Error syncing transaction:", txn._id, error);
      }
    }
  }

  private async syncPendingWorkflows() {
    const pending = await getPendingWorkflows();
    console.log("[Sync] Syncing", pending.length, "pending workflows");

    for (const workflow of pending) {
      try {
        await api.createWorkflow({
          name: workflow.name,
          type: workflow.type,
          amount: workflow.amount,
          description: workflow.description,
          category: workflow.category,
          paymentMethod: workflow.paymentMethod,
          splitAmount: workflow.splitAmount,
        });
        await removePendingWorkflow(workflow._id);
      } catch (error) {
        console.error("[Sync] Error syncing workflow:", workflow._id, error);
      }
    }
  }

  async fetchAllFromServer(): Promise<{
    transactions: ITransaction[];
    workflows: IWorkflow[];
    profile: IUserProfile | null;
  }> {
    try {
      // Check for pending items to determine if we should update balances
      const pendingTxns = await getPendingTransactions();
      const hasPendingTransactions = pendingTxns.length > 0;

      const [transactions, workflows, profile] = await Promise.all([
        api.getTransactions(),
        api.getWorkflows(),
        api.getProfile(),
      ]);

      // Store everything locally
      await setStoredTransactions(transactions);
      await setStoredWorkflows(workflows);
      if (profile) {
        await setStoredProfile(profile);
        // Only reset local balances to server balances if there are NO pending transactions
        // This prevents overwriting local balance changes before they're synced
        if (!hasPendingTransactions) {
          await setLocalBalances(profile.balances);
        }
      }

      return { transactions, workflows, profile };
    } catch (error) {
      console.error("[Sync] Error fetching from server:", error);
      throw error;
    }
  }

  async fetchTransactions(): Promise<ITransaction[]> {
    const isOnline = await this.isOnline();

    if (isOnline) {
      try {
        const transactions = await api.getTransactions();
        await setStoredTransactions(transactions);
        return transactions;
      } catch (error) {
        console.error("[Sync] Error fetching transactions, using local:", error);
      }
    }

    // Return local data (including pending)
    const stored = await getStoredTransactions();
    const pending = await getPendingTransactions();
    return [...pending, ...stored];
  }

  async fetchWorkflows(): Promise<IWorkflow[]> {
    const isOnline = await this.isOnline();

    if (isOnline) {
      try {
        const workflows = await api.getWorkflows();
        await setStoredWorkflows(workflows);
        return workflows;
      } catch (error) {
        console.error("[Sync] Error fetching workflows, using local:", error);
      }
    }

    const stored = await getStoredWorkflows();
    const pending = await getPendingWorkflows();
    return [...pending, ...stored];
  }

  async fetchProfile(): Promise<IUserProfile | null> {
    const isOnline = await this.isOnline();

    if (isOnline) {
      try {
        // Check if there are pending transactions before updating balances
        const pendingTxns = await getPendingTransactions();
        const hasPendingTransactions = pendingTxns.length > 0;

        const profile = await api.getProfile();
        await setStoredProfile(profile);
        // Only update local balances if there are no pending transactions
        if (!hasPendingTransactions) {
          await setLocalBalances(profile.balances);
        }
        return profile;
      } catch (error) {
        console.error("[Sync] Error fetching profile, using local:", error);
      }
    }

    return await getStoredProfile();
  }

  // Update local balance when adding transaction offline
  async updateLocalBalance(
    paymentMethod: "bank" | "cash" | "splitwise",
    amount: number,
    type: "income" | "expense",
    splitAmount?: number
  ) {
    const balances = await getLocalBalances();
    const amt = type === "income" ? amount : -amount;
    balances[paymentMethod] = (balances[paymentMethod] || 0) + amt;

    if (splitAmount && splitAmount > 0 && type === "expense") {
      balances.splitwise = (balances.splitwise || 0) + splitAmount;
    }

    await setLocalBalances(balances);
    return balances;
  }
}

export const syncService = new SyncService();
