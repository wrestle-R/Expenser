import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { api } from "../lib/api";
import { syncService } from "../lib/sync";
import {
  getStoredProfile,
  setStoredProfile,
  getStoredTransactions,
  setStoredTransactions,
  addPendingTransaction,
  removePendingTransaction,
  getStoredWorkflows,
  setStoredWorkflows,
  addPendingWorkflow,
  removePendingWorkflow,
  addPendingDelete,
  getLocalBalances,
  setLocalBalances,
  getPendingTransactions,
  getPendingWorkflows,
} from "../lib/storage";
import { IUserProfile, ITransaction, IWorkflow, ILocalBalance, CreateTransactionPayload, CreateWorkflowPayload } from "../lib/types";
import { generateTempId } from "../lib/utils";
import { notificationService } from "../lib/notifications";

interface UserContextType {
  profile: IUserProfile | null;
  transactions: ITransaction[];
  workflows: IWorkflow[];
  loading: boolean;
  syncing: boolean;
  isOnline: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  refreshProfile: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshWorkflows: () => Promise<void>;
  refreshAll: () => Promise<void>;
  manualRefresh: () => Promise<void>;
  updateProfile: (data: Partial<IUserProfile>) => Promise<void>;
  addTransaction: (
    data: CreateTransactionPayload
  ) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addWorkflow: (
    data: CreateWorkflowPayload
  ) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  getBalance: (method: "bank" | "cash" | "splitwise") => number;
  getTotalBalance: () => number;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const [profile, setProfile] = useState<IUserProfile | null>(null);
  const [transactions, setTransactions] = useState<ITransaction[]>([]);
  const [workflows, setWorkflows] = useState<IWorkflow[]>([]);
  const [localBalances, setLocalBalancesState] = useState<ILocalBalance>({
    bank: 0,
    cash: 0,
    splitwise: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTimeState] = useState<number | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Set API token getter for fresh tokens on every request
  useEffect(() => {
    if (isSignedIn) {
      api.setTokenGetter(() => getToken());
      // Also set initial token for immediate use
      getToken().then((token) => api.setToken(token)).catch(console.error);
    } else {
      api.setToken(null);
      api.setTokenGetter(null);
    }
  }, [isSignedIn, getToken]);

  // Subscribe to sync status changes
  useEffect(() => {
    const unsubscribe = syncService.subscribe(async (status) => {
      setIsOnline(status.isOnline);
      setSyncing(status.isSyncing);
      setPendingCount(status.pendingCount);
      if (status.lastSyncTime) setLastSyncTimeState(status.lastSyncTime);

      // Refresh local state after sync completes
      if (!status.isSyncing && status.isOnline) {
        await loadLocalData();
      }
    });

    return () => unsubscribe();
  }, []);

  // Auto-refresh data from local storage every 3s (reads what sync service has fetched)
  useEffect(() => {
    if (!isSignedIn) return;

    autoRefreshRef.current = setInterval(async () => {
      await loadLocalData();
    }, 3000);

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [isSignedIn]);

  // Pause/resume auto-refresh on app background/foreground
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active" && isSignedIn) {
        // App came back to foreground - trigger a sync
        syncService.syncAll().catch(console.error);
      }
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [isSignedIn]);

  // Load local data on mount
  const loadLocalData = useCallback(async () => {
    try {
      const [storedProfile, storedTxns, storedWorkflows, pendingTxns, pendingWorkflows, balances] =
        await Promise.all([
          getStoredProfile(),
          getStoredTransactions(),
          getStoredWorkflows(),
          getPendingTransactions(),
          getPendingWorkflows(),
          getLocalBalances(),
        ]);

      if (storedProfile) setProfile(storedProfile);
      
      // Merge pending with stored, pending first (newest)
      setTransactions([...pendingTxns, ...storedTxns]);
      setWorkflows([...pendingWorkflows, ...storedWorkflows]);
      setLocalBalancesState(balances);
    } catch (error) {
      console.error("[UserContext] Error loading local data:", error);
    }
  }, []);

  // Initialize data on mount - OFFLINE FIRST
  useEffect(() => {
    async function initialize() {
      if (!isSignedIn) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // Step 1: Load local data IMMEDIATELY (this is what makes it offline-first)
      await loadLocalData();
      setLoading(false); // Show UI right away with cached data

      // Step 2: Initialize sync service + notifications
      syncService.initialize();
      notificationService.initialize().catch(console.error);

      // Step 3: Try to fetch from server in background (non-blocking)
      try {
        const [serverTxns, serverWorkflows, serverProfile] = await Promise.all([
          syncService.fetchTransactions(),
          syncService.fetchWorkflows(),
          syncService.fetchProfile(),
        ]);

        if (serverProfile) setProfile(serverProfile);
        if (serverTxns.length > 0 || serverWorkflows.length > 0) {
          setTransactions(serverTxns);
          setWorkflows(serverWorkflows);
        }
        setLastSyncTimeState(Date.now());
      } catch (error) {
        console.log("[UserContext] Offline - using cached data:", error);
        // This is FINE - we already loaded local data above
      }
    }

    initialize();

    return () => {
      syncService.cleanup();
      notificationService.cleanup();
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [isSignedIn, loadLocalData]);

  const refreshProfile = useCallback(async () => {
    try {
      const serverProfile = await syncService.fetchProfile();
      if (serverProfile) {
        setProfile(serverProfile);
        setLocalBalancesState(serverProfile.balances);
      }
    } catch (error) {
      console.error("[UserContext] Error refreshing profile:", error);
    }
  }, []);

  const refreshTransactions = useCallback(async () => {
    try {
      const txns = await syncService.fetchTransactions();
      setTransactions(txns);
    } catch (error) {
      console.error("[UserContext] Error refreshing transactions:", error);
    }
  }, []);

  const refreshWorkflows = useCallback(async () => {
    try {
      const wfs = await syncService.fetchWorkflows();
      setWorkflows(wfs);
    } catch (error) {
      console.error("[UserContext] Error refreshing workflows:", error);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshProfile(), refreshTransactions(), refreshWorkflows()]);
  }, [refreshProfile, refreshTransactions, refreshWorkflows]);

  // Manual refresh button handler - forces a full sync + fetch
  const manualRefresh = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncService.forceRefresh();
      if (result) {
        if (result.profile) {
          setProfile(result.profile);
          setLocalBalancesState(result.profile.balances);
        }
        setTransactions(result.transactions);
        setWorkflows(result.workflows);
        setLastSyncTimeState(Date.now());
      } else {
        // Offline - at least reload local data
        await loadLocalData();
      }
    } catch (error) {
      console.error("[UserContext] Manual refresh failed:", error);
      // Fall back to loading local data
      await loadLocalData();
    } finally {
      setSyncing(false);
    }
  }, [loadLocalData]);

  const updateProfile = useCallback(
    async (data: Partial<IUserProfile>) => {
      try {
        const online = await syncService.isOnline();
        if (online) {
          const updated = await api.updateProfile(data);
          setProfile(updated);
          await setStoredProfile(updated);
          setLocalBalancesState(updated.balances);
        } else {
          // Update locally
          if (profile) {
            const updated = { ...profile, ...data };
            setProfile(updated);
            await setStoredProfile(updated);
          }
        }
      } catch (error) {
        console.error("[UserContext] Error updating profile:", error);
        throw error;
      }
    },
    [profile]
  );

  const addTransaction = useCallback(
    async (payload: CreateTransactionPayload) => {
      const online = await syncService.isOnline();

      // ALWAYS create a local transaction first for instant UI feedback
      const tempTransaction: ITransaction = {
        _id: generateTempId(),
        clerkId: profile?.clerkId || "",
        type: payload.type,
        amount: payload.amount,
        description: payload.description,
        category: payload.category,
        paymentMethod: payload.paymentMethod,
        splitAmount: payload.splitAmount || 0,
        date: payload.date || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLocal: true,
        syncStatus: "pending",
      };

      // Add to local state immediately
      await addPendingTransaction(tempTransaction);
      setTransactions((prev) => [tempTransaction, ...prev]);

      // Update local balance
      const newBalances = await syncService.updateLocalBalance(
        payload.paymentMethod,
        payload.amount,
        payload.type,
        payload.splitAmount
      );
      setLocalBalancesState(newBalances);
      setPendingCount((prev) => {
        notificationService.onPendingItemAdded(prev + 1);
        return prev + 1;
      });

      if (online) {
        // Try to sync immediately in background
        try {
          console.log("[UserContext] Syncing transaction online:", payload);
          const created = await api.createTransaction(payload);
          // Remove temp and replace with server version
          await removePendingTransaction(tempTransaction._id);
          setTransactions((prev) => 
            prev.map((t) => t._id === tempTransaction._id ? created : t)
          );
          await refreshProfile(); // Refresh to get updated balances
          setPendingCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
          console.log("[UserContext] Failed to sync, will retry later:", error);
          // Transaction is already saved locally - it will sync via auto-refresh
        }
      }
    },
    [profile, refreshProfile]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const online = await syncService.isOnline();
      const isTemp = id.startsWith("temp_");

      // Remove from local state immediately
      setTransactions((prev) => prev.filter((t) => t._id !== id));

      if (isTemp) {
        // Just remove from pending
        const pending = await getPendingTransactions();
        const filtered = pending.filter((t) => t._id !== id);
        // Need to update storage
      } else if (online) {
        try {
          await api.deleteTransaction(id);
          await refreshProfile(); // Refresh to get updated balances
        } catch (error) {
          console.error("[UserContext] Error deleting transaction:", error);
          throw error;
        }
      } else {
        // Queue for deletion when online
        await addPendingDelete({ type: "transaction", id });
        setPendingCount((prev) => {
          notificationService.onPendingItemAdded(prev + 1);
          return prev + 1;
        });
      }
    },
    [refreshProfile]
  );

  const addWorkflow = useCallback(
    async (payload: CreateWorkflowPayload) => {
      const online = await syncService.isOnline();

      // Always save locally first
      const tempWorkflow: IWorkflow = {
        _id: generateTempId(),
        userId: profile?.clerkId || "",
        name: payload.name,
        type: payload.type,
        amount: payload.amount,
        description: payload.description,
        category: payload.category,
        paymentMethod: payload.paymentMethod,
        splitAmount: payload.splitAmount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLocal: true,
        syncStatus: "pending",
      };

      await addPendingWorkflow(tempWorkflow);
      setWorkflows((prev) => [tempWorkflow, ...prev]);
      setPendingCount((prev) => {
        notificationService.onPendingItemAdded(prev + 1);
        return prev + 1;
      });

      if (online) {
        try {
          console.log("[UserContext] Syncing workflow online:", payload);
          const created = await api.createWorkflow(payload);
          await removePendingWorkflow(tempWorkflow._id);
          setWorkflows((prev) =>
            prev.map((w) => w._id === tempWorkflow._id ? created : w)
          );
          setPendingCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
          console.log("[UserContext] Failed to sync workflow, will retry later:", error);
        }
      }
    },
    [profile]
  );

  const deleteWorkflow = useCallback(async (id: string) => {
    const online = await syncService.isOnline();
    const isTemp = id.startsWith("temp_");

    setWorkflows((prev) => prev.filter((w) => w._id !== id));

    if (isTemp) {
      // Just remove from pending (already handled by filter)
    } else if (online) {
      try {
        await api.deleteWorkflow(id);
      } catch (error) {
        console.error("[UserContext] Error deleting workflow:", error);
        throw error;
      }
    } else {
      await addPendingDelete({ type: "workflow", id });
      setPendingCount((prev) => {
        notificationService.onPendingItemAdded(prev + 1);
        return prev + 1;
      });
    }
  }, []);

  const getBalance = useCallback(
    (method: "bank" | "cash" | "splitwise") => {
      if (!profile) return 0;
      // Use local balances which are updated for offline transactions
      return localBalances[method] || profile.balances[method] || 0;
    },
    [profile, localBalances]
  );

  const getTotalBalance = useCallback(() => {
    if (!profile) return 0;
    let total = 0;
    if (profile.paymentMethods.includes("bank")) {
      total += getBalance("bank");
    }
    if (profile.paymentMethods.includes("cash")) {
      total += getBalance("cash");
    }
    if (profile.paymentMethods.includes("splitwise")) {
      total += getBalance("splitwise");
    }
    return total;
  }, [profile, getBalance]);

  return (
    <UserContext.Provider
      value={{
        profile,
        transactions,
        workflows,
        loading,
        syncing,
        isOnline,
        pendingCount,
        lastSyncTime,
        refreshProfile,
        refreshTransactions,
        refreshWorkflows,
        refreshAll,
        manualRefresh,
        updateProfile,
        addTransaction,
        deleteTransaction,
        addWorkflow,
        deleteWorkflow,
        getBalance,
        getTotalBalance,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}
