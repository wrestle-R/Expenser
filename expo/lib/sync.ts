import NetInfo from "@react-native-community/netinfo";
import type { NetInfoState } from "@react-native-community/netinfo";
import { ApiError, api } from "./api";
import {
  claimNextOutboxOperation,
  completeOutboxOperation,
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
  errorKind?: "sync" | "rejected";
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
  private syncRequested = false;
  private online = false;
  private listeners: ((status: SyncStatus) => void)[] = [];
  private unsubscribe: (() => void) | null = null;
  private lastError: string | null = null;
  private lastErrorKind: "sync" | "rejected" = "sync";

  private emit() {
    const status = {
      isOnline: this.online,
      isSyncing: this.syncing,
      ...(this.lastError ? { error: this.lastError, errorKind: this.lastErrorKind } : {}),
    };
    this.listeners.forEach((listener) => listener(status));
    this.lastError = null;
  }

  private async networkState() {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        NetInfo.fetch(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Network check timed out")), NETINFO_TIMEOUT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
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

  private async replaceTransaction(operation: OutboxOperation, transaction: ITransaction) {
    await updateStoredTransactions(async (stored) => {
      const pending = (await getOutbox()).filter((item) =>
        item.id !== operation.id && item.entity === "transaction" &&
        (item.entityId === operation.entityId || item.entityId === transaction._id)
      );
      const local = stored.find((item) => item._id === operation.entityId || item._id === transaction._id);
      const rest = stored.filter((item) =>
        item._id !== operation.entityId && item._id !== transaction._id &&
        (item.clientRequestId || item._id) !== (transaction.clientRequestId || transaction._id)
      );
      if (pending.some((item) => item.action === "delete")) return rest;
      const next = pending.length && local
        ? { ...transaction, ...local, _id: transaction._id, userId: transaction.userId }
        : transaction;
      return [next, ...rest];
    });
  }

  private async replaceWorkflow(operation: OutboxOperation, workflow: IWorkflow) {
    const stored = await getStoredWorkflows();
    const pending = (await getOutbox()).filter((item) =>
      item.id !== operation.id && item.entity === "workflow" &&
      (item.entityId === operation.entityId || item.entityId === workflow._id)
    );
    const local = stored.find((item) => item._id === operation.entityId || item._id === workflow._id);
    const rest = stored.filter((item) => item._id !== operation.entityId && item._id !== workflow._id);
    await setStoredWorkflows(pending.some((item) => item.action === "delete") ? rest : [
      pending.length && local ? { ...workflow, ...local, _id: workflow._id, userId: workflow.userId } : workflow,
      ...rest,
    ]);
  }

  private async replay(operation: OutboxOperation) {
    if (operation.entity === "transaction") {
      if (operation.action === "create") {
        const created = await api.createTransaction(
          operation.payload as unknown as CreateTransactionPayload
        );
        await this.replaceTransaction(operation, created);
        return created._id;
      } else if (operation.action === "update") {
        const updated = await api.updateTransaction(
          operation.entityId,
          operation.payload as UpdateTransactionPayload
        );
        await this.replaceTransaction(operation, updated);
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
        await this.replaceWorkflow(operation, created);
        return created._id;
      } else if (operation.action === "update") {
        const updated = await api.updateWorkflow(operation.entityId, operation.payload);
        await this.replaceWorkflow(operation, updated);
      } else {
        await api.deleteWorkflow(operation.entityId).catch((error) => {
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        });
      }
      return;
    }

    const updated = await api.updateProfile(operation.payload as Partial<IUserProfile>);
    const pending = (await getOutbox()).filter((item) => item.id !== operation.id && item.entity === "profile");
    await setStoredProfile(pending.length ? { ...updated, ...await getStoredProfile() } : updated);
  }

  private async replayOutbox() {
    while (true) {
      const operation = await claimNextOutboxOperation();
      if (!operation) return true;
      try {
        const serverId = await this.replay(operation);
        await completeOutboxOperation(operation, serverId);
      } catch (error) {
        if (isPermanent(error)) {
          console.error("[Outbox] Change rejected permanently:", error);
          this.lastErrorKind = "rejected";
          this.lastError =
            error instanceof Error
              ? error.message
              : "The server rejected an offline change.";
          await removeOutboxOperation(operation.id);
          continue;
        }
        await incrementOutboxAttempt(operation.id);
        this.lastErrorKind = "sync";
        this.lastError = "Changes are saved on this device but could not be uploaded. Please try syncing again.";
        return false;
      }
    }
  }

  async syncAll() {
    if (this.syncing) {
      this.syncRequested = true;
      return null;
    }
    // Reserve the sync before checking connectivity, which can yield to another caller.
    this.syncing = true;
    try {
      if (!(await this.isOnline())) return null;
      this.emit();
      let result;
      do {
        this.syncRequested = false;
        const uploaded = await this.replayOutbox();
        result = await this.fetchAllFromServer();
        if (!uploaded) return result;
      } while (this.syncRequested);
      await setLastSyncTime(Date.now());
      return result;
    } catch (error) {
      this.lastErrorKind = "sync";
      this.lastError = error instanceof Error ? error.message : "Sync failed. Please try again.";
      return null;
    } finally {
      this.syncing = false;
      this.emit();
    }
  }

  async fetchAllFromServer() {
    const results = await Promise.allSettled([
      api.getTransactions(),
      api.getWorkflows(),
      api.getProfile(),
    ]);
    const serverTransactions = results[0].status === "fulfilled" ? results[0].value : null;
    const serverWorkflows = results[1].status === "fulfilled" ? results[1].value : null;
    const serverProfile = results[2].status === "fulfilled" ? results[2].value : null;

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
      serverProfile ? setStoredProfile(operations.some((item) => item.entity === "profile")
        ? { ...serverProfile, ...await getStoredProfile() } : serverProfile) : Promise.resolve(),
    ]);
    const failed = results.some((result) => result.status === "rejected");
    if (failed) {
      const allFailed = results.every((result) => result.status === "rejected");
      throw new Error(allFailed
        ? "Could not refresh from the server. Your saved data is still available. Please try again."
        : "Some data could not be refreshed. Please try syncing again.");
    }
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
    await this.syncAll();
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
