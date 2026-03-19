// Sync service for offline/online synchronization
import NetInfo from '@react-native-community/netinfo';
import {api} from '../remote/api';
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
  setPendingDeletes,
  getStoredProfile,
  setStoredProfile,
  setLastSyncTime,
  getLocalBalances,
  setLocalBalances,
  getLastSyncTime,
} from '../local/storage';
import {ITransaction, IWorkflow, IUserProfile} from '../../domain/types';
import {notificationService} from '../../services/notifications';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
}

const AUTO_REFRESH_INTERVAL = 3000;
const NETINFO_TIMEOUT_MS = 3000;

class SyncService {
  private isSyncing = false;
  private listeners: ((status: SyncStatus) => void)[] = [];
  private unsubscribeNetInfo: (() => void) | null = null;
  private autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private _isOnline = false;

  private async getNetworkStateWithTimeout() {
    return Promise.race([
      NetInfo.fetch(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('NetInfo timeout')),
          NETINFO_TIMEOUT_MS,
        );
      }),
    ]);
  }

  async initialize() {
    this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
      const wasOffline = !this._isOnline;
      this._isOnline = state.isConnected ?? false;

      if (state.isConnected && wasOffline) {
        console.log('[Sync] Network connected, triggering sync...');
        this.syncAll();
      }

      this.notifyListeners();

      if (state.isConnected) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });

    try {
      const state = await this.getNetworkStateWithTimeout();
      this._isOnline = state.isConnected ?? false;
      if (state.isConnected) {
        this.syncAll();
        this.startAutoRefresh();
      }
    } catch (error) {
      console.warn(
        '[Sync] Initial network check timed out, continuing offline',
      );
    }

    this.notifyListeners();
  }

  private startAutoRefresh() {
    if (this.autoRefreshTimer) return;
    console.log('[Sync] Starting auto-refresh every 3s');
    this.autoRefreshTimer = setInterval(() => {
      if (this._isOnline && !this.isSyncing) {
        this.silentRefresh();
      }
    }, AUTO_REFRESH_INTERVAL);
  }

  private stopAutoRefresh() {
    if (this.autoRefreshTimer) {
      console.log('[Sync] Stopping auto-refresh');
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  private async silentRefresh() {
    try {
      const state = await this.getNetworkStateWithTimeout();
      if (!state.isConnected) return;

      const pendingTxns = await getPendingTransactions();
      const pendingWorkflows = await getPendingWorkflows();
      const pendingDeletes = await getPendingDeletes();
      const hasPendingItems =
        pendingTxns.length > 0 ||
        pendingWorkflows.length > 0 ||
        pendingDeletes.length > 0;

      const [transactions, workflows, profile] = await Promise.all([
        api.getTransactions().catch(() => null),
        api.getWorkflows().catch(() => null),
        api.getProfile().catch(() => null),
      ]);

      if (transactions) await setStoredTransactions(transactions);
      if (workflows) await setStoredWorkflows(workflows);
      if (profile) {
        await setStoredProfile(profile);
        if (!hasPendingItems) {
          await setLocalBalances(profile.balances);
        }
      }

      if (hasPendingItems) {
        this.syncAll();
      }

      this.notifyListeners();
    } catch (_error) {
      // Silent fail — background refresh
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
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private async notifyListeners() {
    const status = await this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  async getStatus(): Promise<SyncStatus> {
    const pendingTxns = await getPendingTransactions();
    const pendingWorkflows = await getPendingWorkflows();
    const pendingDeletes = await getPendingDeletes();
    const lastSyncTime = await getLastSyncTime();

    return {
      isOnline: this._isOnline,
      isSyncing: this.isSyncing,
      pendingCount:
        pendingTxns.length + pendingWorkflows.length + pendingDeletes.length,
      lastSyncTime,
    };
  }

  async isOnline(): Promise<boolean> {
    try {
      const state = await this.getNetworkStateWithTimeout();
      this._isOnline = state.isConnected ?? false;
    } catch {
      // Use cached value
    }
    return this._isOnline;
  }

  isOnlineSync(): boolean {
    return this._isOnline;
  }

  async forceRefresh(): Promise<{
    transactions: ITransaction[];
    workflows: IWorkflow[];
    profile: IUserProfile | null;
  } | null> {
    const online = await this.isOnline();
    if (!online) return null;

    try {
      await this.syncAll();
      return await this.fetchAllFromServer();
    } catch (error) {
      console.error('[Sync] Force refresh failed:', error);
      return null;
    }
  }

  async syncAll() {
    if (this.isSyncing) {
      console.log('[Sync] Already syncing, skipping...');
      return;
    }

    const isOnline = await this.isOnline();
    if (!isOnline) {
      console.log('[Sync] Offline, skipping sync...');
      return;
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      console.log('[Sync] Starting full sync...');
      await this.syncPendingDeletes();
      await this.syncPendingTransactions();
      await this.syncPendingWorkflows();
      await this.fetchAllFromServer();
      await setLastSyncTime(Date.now());
      await notificationService.onSyncComplete();
      console.log('[Sync] Sync completed successfully');
    } catch (error) {
      console.error('[Sync] Error during sync:', error);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  private async syncPendingDeletes() {
    const pendingDeletes = await getPendingDeletes();
    console.log('[Sync] Syncing', pendingDeletes.length, 'pending deletes');

    const failedDeletes: typeof pendingDeletes = [];

    for (const item of pendingDeletes) {
      try {
        if (item.type === 'transaction') {
          await api.deleteTransaction(item.id);
        } else if (item.type === 'workflow') {
          await api.deleteWorkflow(item.id);
        }
      } catch (error) {
        console.error('[Sync] Error deleting item:', item, error);
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
    console.log('[Sync] Syncing', pending.length, 'pending transactions');

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
        console.error('[Sync] Error syncing transaction:', txn._id, error);
      }
    }
  }

  private async syncPendingWorkflows() {
    const pending = await getPendingWorkflows();
    console.log('[Sync] Syncing', pending.length, 'pending workflows');

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
        console.error('[Sync] Error syncing workflow:', workflow._id, error);
      }
    }
  }

  async fetchAllFromServer(): Promise<{
    transactions: ITransaction[];
    workflows: IWorkflow[];
    profile: IUserProfile | null;
  }> {
    try {
      const pendingTxns = await getPendingTransactions();
      const hasPendingTransactions = pendingTxns.length > 0;

      const [transactions, workflows, profile] = await Promise.all([
        api.getTransactions(),
        api.getWorkflows(),
        api.getProfile(),
      ]);

      await setStoredTransactions(transactions);
      await setStoredWorkflows(workflows);
      if (profile) {
        await setStoredProfile(profile);
        if (!hasPendingTransactions) {
          await setLocalBalances(profile.balances);
        }
      }

      return {transactions, workflows, profile};
    } catch (error) {
      console.error('[Sync] Error fetching from server:', error);
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
        console.error(
          '[Sync] Error fetching transactions, using local:',
          error,
        );
      }
    }
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
        console.error('[Sync] Error fetching workflows, using local:', error);
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
        const pendingTxns = await getPendingTransactions();
        const hasPendingTransactions = pendingTxns.length > 0;

        const profile = await api.getProfile();
        await setStoredProfile(profile);
        if (!hasPendingTransactions) {
          await setLocalBalances(profile.balances);
        }
        return profile;
      } catch (error) {
        console.error('[Sync] Error fetching profile, using local:', error);
      }
    }
    return await getStoredProfile();
  }

  async updateLocalBalance(
    paymentMethod: 'bank' | 'cash' | 'splitwise',
    amount: number,
    type: 'income' | 'expense',
    splitAmount?: number,
  ) {
    const balances = await getLocalBalances();
    const amt = type === 'income' ? amount : -amount;
    balances[paymentMethod] = (balances[paymentMethod] || 0) + amt;

    if (splitAmount && splitAmount > 0 && type === 'expense') {
      balances.splitwise = (balances.splitwise || 0) + splitAmount;
    }

    await setLocalBalances(balances);
    return balances;
  }
}

export const syncService = new SyncService();
