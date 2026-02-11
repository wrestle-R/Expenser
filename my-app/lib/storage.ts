// Offline storage service using AsyncStorage
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ITransaction,
  IWorkflow,
  IUserProfile,
  ILocalBalance,
} from "./types";

const KEYS = {
  TRANSACTIONS: "@expenser_transactions",
  WORKFLOWS: "@expenser_workflows",
  PROFILE: "@expenser_profile",
  PENDING_TRANSACTIONS: "@expenser_pending_transactions",
  PENDING_WORKFLOWS: "@expenser_pending_workflows",
  PENDING_DELETES: "@expenser_pending_deletes",
  LAST_SYNC: "@expenser_last_sync",
  THEME: "@expenser_theme",
  LOCAL_BALANCES: "@expenser_local_balances",
};

// === Transactions ===
export async function getStoredTransactions(): Promise<ITransaction[]> {
  try {
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
    await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
  } catch (error) {
    console.error("[Storage] Error setting transactions:", error);
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

export async function clearPendingDeletes(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.PENDING_DELETES);
  } catch (error) {
    console.error("[Storage] Error clearing pending deletes:", error);
  }
}

// === Profile ===
export async function getStoredProfile(): Promise<IUserProfile | null> {
  try {
    const data = await AsyncStorage.getItem(KEYS.PROFILE);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("[Storage] Error getting profile:", error);
    return null;
  }
}

export async function setStoredProfile(profile: IUserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
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
      KEYS.LAST_SYNC,
      KEYS.LOCAL_BALANCES,
    ]);
  } catch (error) {
    console.error("[Storage] Error clearing all data:", error);
  }
}
