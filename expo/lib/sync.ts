import NetInfo from "@react-native-community/netinfo";
import type { NetInfoState } from "@react-native-community/netinfo";
import { ApiError, api } from "./api";
import {
  getOutbox,
  getStoredProfile,
  getStoredTransactions,
  getStoredWorkflows,
  incrementOutboxAttempt,
  migrateLegacyPendingData,
  removeOutboxOperation,
  setLastSyncTime,
  setStoredProfile,
  setStoredWorkflows,
  updateStoredTransactions,
  type OutboxOperation,
} from "./storage";
import type {
  CreateTransactionPayload,
  CreateWorkflowPayload,
  ITransaction,
  IUserProfile,
  IWorkflow,
  UpdateTransactionPayload,
} from "./types";
import { mergeServerTransactions } from "./transaction-state.js";

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  error?: string;
}

const NETINFO_TIMEOUT_MS = 3000;

function isOnlineState(state: Pick<NetInfoState, "isConnected" | "isInternetReachable">) {
  return Boolean(state.isConnected && (state.isInternetReachable ?? true));
}

function isPermanent(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    ![401, 403, 408, 409, 429].includes(error.status)
  );
}

class SyncService {
  private initialized = false;
  private syncing = false;
  private online = false;
  private listeners: Array<(status: SyncStatus) => void> = [];
  private unsubscribe: (() => void) | null = null;
  private lastError: string | null = null;

  private emit() {
    const status = {
      isOnline: this.online,
      isSyncing: this.syncing,
      ...(this.lastError ? { error: this.lastError } : {}),
    };
    this.listeners.forEach((listener) => listener(status));
    this.lastError = null;
  }

  private async networkState() {
    return Promise.race([
      NetInfo.fetch(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Network check timed out")), NETINFO_TIMEOUT_MS)
      ),
    ]);
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    await migrateLegacyPendingData();
    this.unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = !this.online;
      this.online = isOnlineState(state);
      this.emit();
      if (wasOffline && this.online) void this.syncAll();
    });
    try {
      this.online = isOnlineState(await this.networkState());
    } catch {
      this.online = false;
    }
    this.emit();
  }

  cleanup() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.initialized = false;
  }

  subscribe(listener: (status: SyncStatus) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  }

  isOnlineSync() {
    return this.online;
  }

  async isOnline() {
    try {
      this.online = isOnlineState(await this.networkState());
    } catch {}
    return this.online;
  }

  private async replaceTransaction(localId: string, transaction: ITransaction) {
    await updateStoredTransactions((stored) => [
      transaction,
      ...stored.filter(
        (item) =>
          item._id !== localId &&
          item._id !== transaction._id &&
          (item.clientRequestId || item._id) !==
            (transaction.clientRequestId || transaction._id)
      ),
    ]);
  }

  private async replaceWorkflow(localId: string, workflow: IWorkflow) {
    const stored = await getStoredWorkflows();
    await setStoredWorkflows([
      workflow,
      ...stored.filter(
        (item) => item._id !== localId && item._id !== workflow._id
      ),
    ]);
  }

  private async replay(operation: OutboxOperation) {
    if (operation.entity === "transaction") {
      if (operation.action === "create") {
        const created = await api.createTransaction(
          operation.payload as unknown as CreateTransactionPayload
        );
        await this.replaceTransaction(operation.entityId, created);
      } else if (operation.action === "update") {
        const updated = await api.updateTransaction(
          operation.entityId,
          operation.payload as UpdateTransactionPayload
        );
        await this.replaceTransaction(operation.entityId, updated);
      } else {
        await api.deleteTransaction(operation.entityId).catch((error) => {
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        });
      }
      return;
    }

    if (operation.entity === "workflow") {
      if (operation.action === "create") {
        const created = await api.createWorkflow(
          operation.payload as unknown as CreateWorkflowPayload
        );
        await this.replaceWorkflow(operation.entityId, created);
      } else if (operation.action === "update") {
        const updated = await api.updateWorkflow(operation.entityId, operation.payload);
        await this.replaceWorkflow(operation.entityId, updated);
      } else {
        await api.deleteWorkflow(operation.entityId).catch((error) => {
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        });
      }
      return;
    }

    const updated = await api.updateProfile(operation.payload as Partial<IUserProfile>);
    await setStoredProfile(updated);
  }

  private async replayOutbox() {
    for (const operation of await getOutbox()) {
      try {
        await this.replay(operation);
        await removeOutboxOperation(operation.id);
      } catch (error) {
        if (isPermanent(error)) {
          console.error("[Outbox] Change rejected permanently:", error);
          this.lastError =
            error instanceof Error
              ? error.message
              : "The server rejected an offline change. Local data was restored.";
          await removeOutboxOperation(operation.id);
          continue;
        }
        await incrementOutboxAttempt(operation.id);
        break;
      }
    }
  }

  async syncAll() {
    if (this.syncing || !(await this.isOnline())) return null;
    this.syncing = true;
    this.emit();
    try {
      await this.replayOutbox();
      const result = await this.fetchAllFromServer();
      await setLastSyncTime(Date.now());
      return result;
    } finally {
      this.syncing = false;
      this.emit();
    }
  }

  async fetchAllFromServer() {
    const localWorkflows = await getStoredWorkflows();
    const operations = await getOutbox();
    const workflowOps = new Set(
      operations.filter((item) => item.entity === "workflow").map((item) => item.entityId)
    );
    const workflowDeletes = new Set(
      operations
        .filter((item) => item.entity === "workflow" && item.action === "delete")
        .map((item) => item.entityId)
    );

    const results = await Promise.allSettled([
      api.getTransactions(),
      api.getWorkflows(),
      api.getProfile(),
    ]);
    const serverTransactions = results[0].status === "fulfilled" ? results[0].value : null;
    const serverWorkflows = results[1].status === "fulfilled" ? results[1].value : null;
    const serverProfile = results[2].status === "fulfilled" ? results[2].value : null;

    const transactions = serverTransactions
      ? await updateStoredTransactions(async (localTransactions) =>
          mergeServerTransactions({
            localTransactions,
            serverTransactions,
            operations: await getOutbox(),
          })
        )
      : await getStoredTransactions();
    const workflows = serverWorkflows
      ? [
          ...localWorkflows.filter((item) => workflowOps.has(item._id)),
          ...serverWorkflows.filter(
            (item) => !workflowOps.has(item._id) && !workflowDeletes.has(item._id)
          ),
        ]
      : localWorkflows;

    await Promise.all([
      setStoredWorkflows(workflows),
      serverProfile ? setStoredProfile(serverProfile) : Promise.resolve(),
    ]);
    return {
      transactions,
      workflows,
      profile: serverProfile ?? (await getStoredProfile()),
    };
  }

  async forceRefresh() {
    if (!(await this.isOnline())) return null;
    return this.syncAll();
  }

  async fetchTransactions() {
    if ((await this.isOnline()) && !this.syncing) {
      this.syncing = true;
      this.emit();
      try {
        await this.replayOutbox();
        const serverTransactions = await api.getTransactions();
        await updateStoredTransactions(async (localTransactions) =>
          mergeServerTransactions({
            localTransactions,
            serverTransactions,
            operations: await getOutbox(),
          })
        );
        await setLastSyncTime(Date.now());
      } finally {
        this.syncing = false;
        this.emit();
      }
    }
    return getStoredTransactions();
  }

  async fetchWorkflows() {
    if (await this.isOnline()) await this.syncAll();
    return getStoredWorkflows();
  }

  async fetchProfile() {
    if (await this.isOnline()) await this.syncAll();
    return getStoredProfile();
  }
}

export const syncService = new SyncService();
