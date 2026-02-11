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

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
}

class SyncService {
  private isSyncing = false;
  private listeners: ((status: SyncStatus) => void)[] = [];
  private unsubscribeNetInfo: (() => void) | null = null;

  async initialize() {
    // Listen for network state changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        console.log("[Sync] Network connected, triggering sync...");
        this.syncAll();
      }
    });

    // Check current network state and sync if online
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      this.syncAll();
    }
  }

  cleanup() {
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
    const state = await NetInfo.fetch();
    const pendingTxns = await getPendingTransactions();
    const pendingWorkflows = await getPendingWorkflows();
    const pendingDeletes = await getPendingDeletes();

    return {
      isOnline: state.isConnected ?? false,
      isSyncing: this.isSyncing,
      pendingCount:
        pendingTxns.length + pendingWorkflows.length + pendingDeletes.length,
      lastSyncTime: null,
    };
  }

  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
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
        // Reset local balances to server balances
        await setLocalBalances(profile.balances);
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
        const profile = await api.getProfile();
        await setStoredProfile(profile);
        await setLocalBalances(profile.balances);
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
