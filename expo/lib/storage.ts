// Offline storage service using AsyncStorage
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BankReviewEvent,
  ITransaction,
  IWorkflow,
  IUserProfile,
  ILocalBalance,
  BottomTabSlot,
} from "./types";
import { coalesceOutboxOperation } from "./outbox";
import { withDefaultPaymentMethod } from "./payment-methods.js";

const KEYS = {
  TRANSACTIONS: "@expenser_transactions",
  WORKFLOWS: "@expenser_workflows",
  PROFILE: "@expenser_profile",
  PENDING_TRANSACTIONS: "@expenser_pending_transactions",
  PENDING_WORKFLOWS: "@expenser_pending_workflows",
  PENDING_DELETES: "@expenser_pending_deletes",
  PENDING_PROFILE: "@expenser_pending_profile",
  LAST_SYNC: "@expenser_last_sync",
  THEME: "@expenser_theme",
  STEALTH_MODE: "@expenser_stealth_mode",
  LOCAL_BALANCES: "@expenser_local_balances",
  BANK_REVIEW_EVENTS: "@expenser_bank_review_events",
  BOTTOM_TAB_SLOTS: "@expenser_bottom_tab_slots",
  OUTBOX: "@expenser_outbox_v2",
  OUTBOX_MIGRATED: "@expenser_outbox_v2_migrated",
};

let transactionStorageQueue: Promise<unknown> = Promise.resolve();
let outboxStorageQueue: Promise<unknown> = Promise.resolve();

function enqueueStorageMutation<T>(
  queue: "transactions" | "outbox",
  mutation: () => Promise<T>
) {
  const previous =
    queue === "transactions" ? transactionStorageQueue : outboxStorageQueue;
  const result = previous.then(mutation, mutation);
  const settled = result.then(
    () => undefined,
    () => undefined
  );
  if (queue === "transactions") transactionStorageQueue = settled;
  else outboxStorageQueue = settled;
  return result;
}

export type OutboxEntity = "transaction" | "workflow" | "profile";
export type OutboxAction = "create" | "update" | "delete";

export interface OutboxOperation {
  version: 2;
  id: string;
  entity: OutboxEntity;
  entityId: string;
  action: OutboxAction;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
}

function outboxId() {
  return `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readOutbox(): Promise<OutboxOperation[]> {
  const data = await AsyncStorage.getItem(KEYS.OUTBOX);
  return data ? JSON.parse(data) : [];
}

async function writeOutbox(operations: OutboxOperation[]) {
  await AsyncStorage.setItem(KEYS.OUTBOX, JSON.stringify(operations));
}

export async function getOutbox(): Promise<OutboxOperation[]> {
  await outboxStorageQueue;
  return readOutbox();
}

export async function setOutbox(operations: OutboxOperation[]) {
  await enqueueStorageMutation("outbox", () => writeOutbox(operations));
}

export async function removeOutboxOperation(id: string) {
  await enqueueStorageMutation("outbox", async () => {
    await writeOutbox((await readOutbox()).filter((operation) => operation.id !== id));
  });
}

export async function incrementOutboxAttempt(id: string) {
  await enqueueStorageMutation("outbox", async () => {
    await writeOutbox((await readOutbox()).map((operation) =>
      operation.id === id
        ? { ...operation, attempts: operation.attempts + 1 }
        : operation
    ));
  });
}

export async function enqueueOutbox(input: {
  entity: OutboxEntity;
  entityId: string;
  action: OutboxAction;
  payload?: Record<string, unknown>;
}) {
  await enqueueStorageMutation("outbox", async () => {
    const operations = await readOutbox();
    const next = coalesceOutboxOperation(operations, input, () => ({
      version: 2,
      id: outboxId(),
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      payload: input.payload ?? {},
      createdAt: new Date().toISOString(),
      attempts: 0,
    }));
    await writeOutbox(next);
  });
}

export async function migrateLegacyPendingData() {
  if ((await AsyncStorage.getItem(KEYS.OUTBOX_MIGRATED)) === "true") return;

  const [transactions, workflows, deletes, profile] = await Promise.all([
    getPendingTransactions(),
    getPendingWorkflows(),
    getPendingDeletes(),
    getPendingProfileUpdate(),
  ]);

  if (transactions.length) {
    const stored = await getStoredTransactions();
    await setStoredTransactions([
      ...transactions,
      ...stored.filter(
        (item) => !transactions.some((pending) => pending._id === item._id)
      ),
    ]);
  }
  if (workflows.length) {
    const stored = await getStoredWorkflows();
    await setStoredWorkflows([
      ...workflows,
      ...stored.filter(
        (item) => !workflows.some((pending) => pending._id === item._id)
      ),
    ]);
  }

  for (const transaction of transactions) {
    await enqueueOutbox({
      entity: "transaction",
      entityId: transaction._id,
      action: "create",
      payload: transaction as unknown as Record<string, unknown>,
    });
  }
  for (const workflow of workflows) {
    await enqueueOutbox({
      entity: "workflow",
      entityId: workflow._id,
      action: "create",
      payload: workflow as unknown as Record<string, unknown>,
    });
  }
  for (const item of deletes) {
    await enqueueOutbox({ entity: item.type, entityId: item.id, action: "delete" });
  }
  if (deletes.length) {
    const deletedTransactions = new Set(
      deletes.filter((item) => item.type === "transaction").map((item) => item.id)
    );
    const deletedWorkflows = new Set(
      deletes.filter((item) => item.type === "workflow").map((item) => item.id)
    );
    await Promise.all([
      getStoredTransactions().then((items) =>
        setStoredTransactions(items.filter((item) => !deletedTransactions.has(item._id)))
      ),
      getStoredWorkflows().then((items) =>
        setStoredWorkflows(items.filter((item) => !deletedWorkflows.has(item._id)))
      ),
    ]);
  }
  if (profile) {
    await enqueueOutbox({
      entity: "profile",
      entityId: "current",
      action: "update",
      payload: profile as Record<string, unknown>,
    });
  }

  await AsyncStorage.multiRemove([
    KEYS.PENDING_TRANSACTIONS,
    KEYS.PENDING_WORKFLOWS,
    KEYS.PENDING_DELETES,
    KEYS.PENDING_PROFILE,
  ]);
  await AsyncStorage.setItem(KEYS.OUTBOX_MIGRATED, "true");
}

const DEFAULT_BOTTOM_TAB_SLOTS: BottomTabSlot[] = [
  "transactions",
  "analysis",
  "empty",
];

function normalizeBottomTabSlots(value: unknown): BottomTabSlot[] {
  const allowed = new Set<BottomTabSlot>([
    "transactions",
    "workflows",
    "analysis",
    "empty",
  ]);
  const source = Array.isArray(value) ? value : DEFAULT_BOTTOM_TAB_SLOTS;
  const normalized = source
    .filter((item): item is BottomTabSlot => allowed.has(item as BottomTabSlot))
    .slice(0, 3);

  while (normalized.length < 3) {
    normalized.push("empty");
  }

  return normalized;
}

// === Transactions ===
export async function getStoredTransactions(): Promise<ITransaction[]> {
  try {
    await transactionStorageQueue;
    const data = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[Storage] Error getting transactions:", error);
    return [];
  }
}

export async function setStoredTransactions(
  transactions: ITransaction[]
): Promise<void> {
  try {
    await enqueueStorageMutation("transactions", () =>
      AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions))
    );
  } catch (error) {
    console.error("[Storage] Error setting transactions:", error);
    throw error;
  }
}

export async function updateStoredTransactions(
  update: (transactions: ITransaction[]) => ITransaction[] | Promise<ITransaction[]>
): Promise<ITransaction[]> {
  try {
    return await enqueueStorageMutation("transactions", async () => {
      const data = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
      const current: ITransaction[] = data ? JSON.parse(data) : [];
      const next = await update(current);
      await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(next));
      return next;
    });
  } catch (error) {
    console.error("[Storage] Error updating transactions:", error);
    throw error;
  }
}

export async function addPendingTransaction(
  transaction: ITransaction
): Promise<void> {
  try {
    const pending = await getPendingTransactions();
    pending.push(transaction);
    await AsyncStorage.setItem(
      KEYS.PENDING_TRANSACTIONS,
      JSON.stringify(pending)
    );
  } catch (error) {
    console.error("[Storage] Error adding pending transaction:", error);
  }
}

export async function getPendingTransactions(): Promise<ITransaction[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.PENDING_TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[Storage] Error getting pending transactions:", error);
    return [];
  }
}

export async function clearPendingTransactions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.PENDING_TRANSACTIONS);
  } catch (error) {
    console.error("[Storage] Error clearing pending transactions:", error);
  }
}

export async function removePendingTransaction(tempId: string): Promise<void> {
  try {
    const pending = await getPendingTransactions();
    const filtered = pending.filter((t) => t._id !== tempId);
    await AsyncStorage.setItem(
      KEYS.PENDING_TRANSACTIONS,
      JSON.stringify(filtered)
    );
  } catch (error) {
    console.error("[Storage] Error removing pending transaction:", error);
  }
}

// === Bank Review Events ===
export async function getStoredBankReviewEvents(): Promise<BankReviewEvent[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.BANK_REVIEW_EVENTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[Storage] Error getting bank review events:", error);
    return [];
  }
}

export async function addStoredBankReviewEvent(event: BankReviewEvent): Promise<boolean> {
  try {
    const existing = await getStoredBankReviewEvents();
    await AsyncStorage.setItem(
      KEYS.BANK_REVIEW_EVENTS,
      JSON.stringify([
        event,
        ...existing.filter((item) => item.importSourceKey !== event.importSourceKey),
      ].slice(0, 50))
    );
    return true;
  } catch (error) {
    console.error("[Storage] Error adding bank review event:", error);
    return false;
  }
}

export async function clearStoredBankReviewEvents(sourceKeys: string[]): Promise<void> {
  try {
    if (sourceKeys.length === 0) {
      return;
    }

    const keys = new Set(sourceKeys);
    const existing = await getStoredBankReviewEvents();
    await AsyncStorage.setItem(
      KEYS.BANK_REVIEW_EVENTS,
      JSON.stringify(existing.filter((event) => !keys.has(event.importSourceKey)))
    );
  } catch (error) {
    console.error("[Storage] Error clearing bank review events:", error);
  }
}

// === Workflows ===
export async function getStoredWorkflows(): Promise<IWorkflow[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.WORKFLOWS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[Storage] Error getting workflows:", error);
    return [];
  }
}

export async function setStoredWorkflows(workflows: IWorkflow[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.WORKFLOWS, JSON.stringify(workflows));
  } catch (error) {
    console.error("[Storage] Error setting workflows:", error);
  }
}

export async function addPendingWorkflow(workflow: IWorkflow): Promise<void> {
  try {
    const pending = await getPendingWorkflows();
    pending.push(workflow);
    await AsyncStorage.setItem(KEYS.PENDING_WORKFLOWS, JSON.stringify(pending));
  } catch (error) {
    console.error("[Storage] Error adding pending workflow:", error);
  }
}

export async function getPendingWorkflows(): Promise<IWorkflow[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.PENDING_WORKFLOWS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[Storage] Error getting pending workflows:", error);
    return [];
  }
}

export async function clearPendingWorkflows(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.PENDING_WORKFLOWS);
  } catch (error) {
    console.error("[Storage] Error clearing pending workflows:", error);
  }
}

export async function removePendingWorkflow(tempId: string): Promise<void> {
  try {
    const pending = await getPendingWorkflows();
    const filtered = pending.filter((w) => w._id !== tempId);
    await AsyncStorage.setItem(KEYS.PENDING_WORKFLOWS, JSON.stringify(filtered));
  } catch (error) {
    console.error("[Storage] Error removing pending workflow:", error);
  }
}

// === Pending Deletes ===
export interface PendingDelete {
  type: "transaction" | "workflow";
  id: string;
}

export async function addPendingDelete(item: PendingDelete): Promise<void> {
  try {
    const pending = await getPendingDeletes();
    pending.push(item);
    await AsyncStorage.setItem(KEYS.PENDING_DELETES, JSON.stringify(pending));
  } catch (error) {
    console.error("[Storage] Error adding pending delete:", error);
  }
}

export async function getPendingDeletes(): Promise<PendingDelete[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.PENDING_DELETES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[Storage] Error getting pending deletes:", error);
    return [];
  }
}

export async function setPendingDeletes(items: PendingDelete[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.PENDING_DELETES, JSON.stringify(items));
  } catch (error) {
    console.error("[Storage] Error setting pending deletes:", error);
  }
}

export async function clearPendingDeletes(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.PENDING_DELETES);
  } catch (error) {
    console.error("[Storage] Error clearing pending deletes:", error);
  }
}

// === Pending Profile Update ===
export async function getPendingProfileUpdate(): Promise<Partial<IUserProfile> | null> {
  try {
    const data = await AsyncStorage.getItem(KEYS.PENDING_PROFILE);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("[Storage] Error getting pending profile update:", error);
    return null;
  }
}

export async function setPendingProfileUpdate(
  profile: Partial<IUserProfile>
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.PENDING_PROFILE, JSON.stringify(profile));
  } catch (error) {
    console.error("[Storage] Error setting pending profile update:", error);
  }
}

export async function clearPendingProfileUpdate(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.PENDING_PROFILE);
  } catch (error) {
    console.error("[Storage] Error clearing pending profile update:", error);
  }
}

// === Profile ===
export async function getStoredProfile(): Promise<IUserProfile | null> {
  try {
    const data = await AsyncStorage.getItem(KEYS.PROFILE);
    if (!data) return null;
    const profile = JSON.parse(data) as IUserProfile;
    return {
      ...profile,
      paymentMethods: withDefaultPaymentMethod(profile.paymentMethods),
    };
  } catch (error) {
    console.error("[Storage] Error getting profile:", error);
    return null;
  }
}

export async function setStoredProfile(profile: IUserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(
      KEYS.PROFILE,
      JSON.stringify({
        ...profile,
        paymentMethods: withDefaultPaymentMethod(profile.paymentMethods),
      })
    );
  } catch (error) {
    console.error("[Storage] Error setting profile:", error);
  }
}

// === Local Balances (for offline balance tracking) ===
export async function getLocalBalances(): Promise<ILocalBalance> {
  try {
    const data = await AsyncStorage.getItem(KEYS.LOCAL_BALANCES);
    return data ? JSON.parse(data) : { bank: 0, cash: 0, splitwise: 0 };
  } catch (error) {
    console.error("[Storage] Error getting local balances:", error);
    return { bank: 0, cash: 0, splitwise: 0 };
  }
}

export async function getStoredLocalBalances(): Promise<ILocalBalance | null> {
  try {
    const data = await AsyncStorage.getItem(KEYS.LOCAL_BALANCES);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("[Storage] Error getting stored local balances:", error);
    return null;
  }
}

export async function setLocalBalances(balances: ILocalBalance): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.LOCAL_BALANCES, JSON.stringify(balances));
  } catch (error) {
    console.error("[Storage] Error setting local balances:", error);
  }
}

// === Theme ===
export async function getStoredTheme(): Promise<"light" | "dark" | null> {
  try {
    const data = await AsyncStorage.getItem(KEYS.THEME);
    return data as "light" | "dark" | null;
  } catch (error) {
    console.error("[Storage] Error getting theme:", error);
    return null;
  }
}

export async function setStoredTheme(theme: "light" | "dark"): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.THEME, theme);
  } catch (error) {
    console.error("[Storage] Error setting theme:", error);
  }
}

// === Stealth Mode ===
export async function getStoredStealthMode(): Promise<boolean> {
  try {
    const data = await AsyncStorage.getItem(KEYS.STEALTH_MODE);
    if (data == null) {
      return true;
    }
    return data === "true";
  } catch (error) {
    console.error("[Storage] Error getting stealth mode:", error);
    return true;
  }
}

export async function setStoredStealthMode(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.STEALTH_MODE, String(enabled));
  } catch (error) {
    console.error("[Storage] Error setting stealth mode:", error);
  }
}

// === Bottom Tabs ===
export async function getStoredBottomTabSlots(): Promise<BottomTabSlot[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.BOTTOM_TAB_SLOTS);
    return normalizeBottomTabSlots(data ? JSON.parse(data) : null);
  } catch (error) {
    console.error("[Storage] Error getting bottom tab slots:", error);
    return DEFAULT_BOTTOM_TAB_SLOTS;
  }
}

export async function setStoredBottomTabSlots(
  slots: BottomTabSlot[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      KEYS.BOTTOM_TAB_SLOTS,
      JSON.stringify(normalizeBottomTabSlots(slots))
    );
  } catch (error) {
    console.error("[Storage] Error setting bottom tab slots:", error);
  }
}

// === Sync Metadata ===
export async function getLastSyncTime(): Promise<number | null> {
  try {
    const data = await AsyncStorage.getItem(KEYS.LAST_SYNC);
    return data ? parseInt(data, 10) : null;
  } catch (error) {
    console.error("[Storage] Error getting last sync time:", error);
    return null;
  }
}

export async function setLastSyncTime(time: number): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.LAST_SYNC, time.toString());
  } catch (error) {
    console.error("[Storage] Error setting last sync time:", error);
  }
}

// === Clear All Data (for logout) ===
export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      KEYS.TRANSACTIONS,
      KEYS.WORKFLOWS,
      KEYS.PROFILE,
      KEYS.PENDING_TRANSACTIONS,
      KEYS.PENDING_WORKFLOWS,
      KEYS.PENDING_DELETES,
      KEYS.PENDING_PROFILE,
      KEYS.LAST_SYNC,
      KEYS.LOCAL_BALANCES,
      KEYS.BANK_REVIEW_EVENTS,
      KEYS.OUTBOX,
      KEYS.OUTBOX_MIGRATED,
    ]);
  } catch (error) {
    console.error("[Storage] Error clearing all data:", error);
  }
}
