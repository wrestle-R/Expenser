// Sync service for handling offline/online synchronization
import NetInfo from "@react-native-community/netinfo";
import type { NetInfoState } from "@react-native-community/netinfo";
import { ApiError, api } from "./api";
import {
  getStoredTransactions,
  setStoredTransactions,
  getPendingTransactions,
  removePendingTransaction,
  getStoredWorkflows,
  setStoredWorkflows,
  getPendingWorkflows,
  removePendingWorkflow,
  getPendingDeletes,
  getLastSyncTime,
  clearPendingDeletes,
  setPendingDeletes,
  getStoredProfile,
  setStoredProfile,
  setLastSyncTime,
  getLocalBalances,
  setLocalBalances,
  getPendingProfileUpdate,
  clearPendingProfileUpdate,
} from "./storage";
import { ITransaction, IWorkflow, IUserProfile } from "./types";
import { notificationService } from "./notifications";

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
}

const NETINFO_TIMEOUT_MS = 3000;

class SyncService {
  private initialized = false;
  private isSyncing = false;
  private listeners: ((status: SyncStatus) => void)[] = [];
  private unsubscribeNetInfo: (() => void) | null = null;
  private _isOnline = false;

  private isStateOnline(
    state: Pick<NetInfoState, "isConnected" | "isInternetReachable">
  ) {
    if (!state.isConnected) {
      return false;
    }

    return state.isInternetReachable ?? true;
  }

  private mergeProfile(
    base: IUserProfile | null,
    pending: Partial<IUserProfile> | null
  ): IUserProfile | null {
    if (!base) {
      return null;
    }

    return pending ? { ...base, ...pending } : base;
  }

  private mergeServerTransactions(
    serverTransactions: ITransaction[],
    failedLocalTransactions: ITransaction[]
  ) {
    return [
      ...failedLocalTransactions,
      ...serverTransactions.filter(
        (transaction) =>
          !failedLocalTransactions.some(
            (failed) =>
              failed._id === transaction._id ||
              (failed.clientRequestId || failed._id) ===
                (transaction.clientRequestId || transaction._id)
          )
      ),
    ];
  }

  private mergeServerWorkflows(
    serverWorkflows: IWorkflow[],
    failedLocalWorkflows: IWorkflow[]
  ) {
    return [
      ...failedLocalWorkflows,
      ...serverWorkflows.filter(
        (workflow) =>
          !failedLocalWorkflows.some(
            (failed) =>
              failed._id === workflow._id ||
              (failed.clientRequestId || failed._id) ===
                (workflow.clientRequestId || workflow._id)
          )
      ),
    ];
  }

  private upsertStoredTransaction(transaction: ITransaction) {
    return getStoredTransactions().then(async (storedTransactions) => {
      const filtered = storedTransactions.filter(
        (item) =>
          item._id !== transaction._id &&
          (item.clientRequestId || item._id) !==
            (transaction.clientRequestId || transaction._id)
      );
      await setStoredTransactions([transaction, ...filtered]);
    });
  }

  private upsertStoredWorkflow(workflow: IWorkflow) {
    return getStoredWorkflows().then(async (storedWorkflows) => {
      const filtered = storedWorkflows.filter((item) => item._id !== workflow._id);
      await setStoredWorkflows([workflow, ...filtered]);
    });
  }

  private isDeleteConflictSafe(error: unknown) {
    return error instanceof ApiError && error.status === 404;
  }

  private isNonRetryableSyncError(error: unknown) {
    if (!(error instanceof ApiError)) {
      return false;
    }

    return (
      error.status >= 400 &&
      error.status < 500 &&
      ![401, 403, 408, 409, 429].includes(error.status)
    );
  }

  private async preserveFailedTransaction(
    transaction: ITransaction,
    error: unknown
  ) {
    const failedTransaction: ITransaction = {
      ...transaction,
      isLocal: true,
      syncStatus: "failed",
      syncError: error instanceof Error ? error.message : "Sync failed",
    };
    await this.upsertStoredTransaction(failedTransaction);
  }

  private async preserveFailedWorkflow(workflow: IWorkflow, error: unknown) {
    const failedWorkflow: IWorkflow = {
      ...workflow,
      isLocal: true,
      syncStatus: "failed",
      syncError: error instanceof Error ? error.message : "Sync failed",
    };
    await this.upsertStoredWorkflow(failedWorkflow);
  }

  private async getNetworkStateWithTimeout() {
    return Promise.race([
      NetInfo.fetch(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("NetInfo timeout")), NETINFO_TIMEOUT_MS);
      }),
    ]);
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    // Listen for network state changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const wasOffline = !this._isOnline;
      this._isOnline = this.isStateOnline(state);

      if (this._isOnline && wasOffline) {
        console.log("[Sync] Network connected, triggering sync...");
        this.syncAll();
      }

      // Notify listeners about connectivity change
      this.notifyListeners();
    });

    // Check current network state
    try {
      const state = await this.getNetworkStateWithTimeout();
      this._isOnline = this.isStateOnline(state);
    } catch (error) {
      console.warn("[Sync] Initial network check timed out, continuing offline mode");
    }

    this.notifyListeners();
  }

  cleanup() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.initialized = false;
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
    const pendingProfile = await getPendingProfileUpdate();
    const lastSyncTime = await getLastSyncTime();

    return {
      isOnline: this._isOnline,
      isSyncing: this.isSyncing,
      pendingCount:
        pendingTxns.length +
        pendingWorkflows.length +
        pendingDeletes.length +
        (pendingProfile ? 1 : 0),
      lastSyncTime,
    };
  }

  async isOnline(): Promise<boolean> {
    // Use cached value first for speed, but verify with NetInfo
    try {
      const state = await this.getNetworkStateWithTimeout();
      this._isOnline = this.isStateOnline(state);
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

      // 4. Sync pending profile edits
      await this.syncPendingProfile();

      // 5. Fetch fresh data from server
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

    const failedDeletes: typeof pendingDeletes = [];

    for (const item of pendingDeletes) {
      try {
        if (item.type === "transaction") {
          await api.deleteTransaction(item.id);
        } else if (item.type === "workflow") {
          await api.deleteWorkflow(item.id);
        }
      } catch (error) {
        if (this.isDeleteConflictSafe(error)) {
          continue;
        }
        console.error("[Sync] Error deleting item:", item, error);
        failedDeletes.push(item);
      }
    }

    if (failedDeletes.length > 0) {
      await setPendingDeletes(failedDeletes);
      return;
    }

    await clearPendingDeletes();
  }

  private async syncPendingTransactions() {
    const pending = await getPendingTransactions();
    console.log("[Sync] Syncing", pending.length, "pending transactions");

    for (const txn of pending) {
      try {
        const created = await api.createTransaction({
          type: txn.type,
          amount: txn.amount,
          description: txn.description,
          category: txn.category,
          paymentMethod: txn.paymentMethod,
          splitAmount: txn.splitAmount,
          exchangeExpenseId: txn.exchangeExpenseId,
          date: txn.date,
          clientRequestId: txn.clientRequestId ?? txn._id,
        });
        await this.upsertStoredTransaction(created);
        await removePendingTransaction(txn._id);
      } catch (error) {
        if (this.isNonRetryableSyncError(error)) {
          await this.preserveFailedTransaction(txn, error);
          await removePendingTransaction(txn._id);
          continue;
        }
        console.error("[Sync] Error syncing transaction:", txn._id, error);
      }
    }
  }

  private async syncPendingWorkflows() {
    const pending = await getPendingWorkflows();
    console.log("[Sync] Syncing", pending.length, "pending workflows");

    for (const workflow of pending) {
      try {
        const created = await api.createWorkflow({
          name: workflow.name,
          type: workflow.type,
          amount: workflow.amount,
          description: workflow.description,
          category: workflow.category,
          paymentMethod: workflow.paymentMethod,
          splitAmount: workflow.splitAmount,
          clientRequestId: workflow.clientRequestId ?? workflow._id,
        });
        await this.upsertStoredWorkflow(created);
        await removePendingWorkflow(workflow._id);
      } catch (error) {
        if (this.isNonRetryableSyncError(error)) {
          await this.preserveFailedWorkflow(workflow, error);
          await removePendingWorkflow(workflow._id);
          continue;
        }
        console.error("[Sync] Error syncing workflow:", workflow._id, error);
      }
    }
  }

  private async syncPendingProfile() {
    const pendingProfile = await getPendingProfileUpdate();
    if (!pendingProfile) {
      return;
    }

    try {
      const updated = await api.updateProfile(pendingProfile);
      await setStoredProfile(updated);
      await clearPendingProfileUpdate();
    } catch (error) {
      console.error("[Sync] Error syncing pending profile:", error);
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
      const pendingProfile = await getPendingProfileUpdate();
      const failedLocalTransactions = (await getStoredTransactions()).filter(
        (transaction) => transaction.isLocal && transaction.syncStatus === "failed"
      );
      const failedLocalWorkflows = (await getStoredWorkflows()).filter(
        (workflow) => workflow.isLocal && workflow.syncStatus === "failed"
      );

      const [transactionsResult, workflowsResult, profileResult] = await Promise.allSettled([
        api.getTransactions(),
        api.getWorkflows(),
        api.getProfile(),
      ]);

      const transactions =
        transactionsResult.status === "fulfilled" ? transactionsResult.value : null;
      const workflows =
        workflowsResult.status === "fulfilled" ? workflowsResult.value : null;
      const profile =
        profileResult.status === "fulfilled" ? profileResult.value : null;

      if (!transactions && !workflows && !profile) {
        throw new Error("Failed to fetch fresh data from the server");
      }

      if (transactionsResult.status === "rejected") {
        console.error("[Sync] Error fetching transactions from server:", transactionsResult.reason);
      }
      if (workflowsResult.status === "rejected") {
        console.error("[Sync] Error fetching workflows from server:", workflowsResult.reason);
      }
      if (profileResult.status === "rejected") {
        console.error("[Sync] Error fetching profile from server:", profileResult.reason);
      }

      if (transactions) {
        await setStoredTransactions(
          this.mergeServerTransactions(transactions, failedLocalTransactions)
        );
      }
      if (workflows) {
        await setStoredWorkflows(
          this.mergeServerWorkflows(workflows, failedLocalWorkflows)
        );
      }
      if (profile) {
        await setStoredProfile(this.mergeProfile(profile, pendingProfile) ?? profile);
        // Only reset local balances to server balances if there are NO pending transactions
        // This prevents overwriting local balance changes before they're synced
        if (!hasPendingTransactions) {
          await setLocalBalances(profile.balances);
        }
      }

      return {
        transactions:
          transactions ??
          this.mergeServerTransactions(
            await getStoredTransactions(),
            failedLocalTransactions
          ),
        workflows:
          workflows ??
          this.mergeServerWorkflows(
            await getStoredWorkflows(),
            failedLocalWorkflows
          ),
        profile: profile ?? (await getStoredProfile()),
      };
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
        const failedLocalTransactions = (await getStoredTransactions()).filter(
          (transaction) => transaction.isLocal && transaction.syncStatus === "failed"
        );
        const mergedTransactions = this.mergeServerTransactions(
          transactions,
          failedLocalTransactions
        );
        await setStoredTransactions(mergedTransactions);
        return mergedTransactions;
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
        const failedLocalWorkflows = (await getStoredWorkflows()).filter(
          (workflow) => workflow.isLocal && workflow.syncStatus === "failed"
        );
        const mergedWorkflows = this.mergeServerWorkflows(
          workflows,
          failedLocalWorkflows
        );
        await setStoredWorkflows(mergedWorkflows);
        return mergedWorkflows;
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
        const pendingProfile = await getPendingProfileUpdate();
        // Check if there are pending transactions before updating balances
        const pendingTxns = await getPendingTransactions();
        const hasPendingTransactions = pendingTxns.length > 0;

        const profile = await api.getProfile();
        await setStoredProfile(this.mergeProfile(profile, pendingProfile) ?? profile);
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
  async applyLocalTransactionImpact(
    transaction: Pick<
      ITransaction,
      "paymentMethod" | "amount" | "type" | "splitAmount"
    >,
    direction: 1 | -1
  ) {
    const balances = await getLocalBalances();
    const signedAmount =
      transaction.type === "income"
        ? transaction.amount * direction
        : -transaction.amount * direction;

    balances[transaction.paymentMethod] =
      (balances[transaction.paymentMethod] || 0) + signedAmount;

    if (
      transaction.type === "expense" &&
      transaction.splitAmount &&
      transaction.splitAmount > 0
    ) {
      balances.splitwise =
        (balances.splitwise || 0) + transaction.splitAmount * direction;
    }

    await setLocalBalances(balances);
    return balances;
  }

  async updateLocalBalance(
    paymentMethod: "bank" | "cash" | "splitwise",
    amount: number,
    type: "income" | "expense",
    splitAmount?: number
  ) {
    return this.applyLocalTransactionImpact(
      {
        paymentMethod,
        amount,
        type,
        splitAmount,
      },
      1
    );
  }
}

export const syncService = new SyncService();
