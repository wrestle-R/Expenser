import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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
  getStoredLocalBalances,
  getPendingTransactions,
  getPendingWorkflows,
  getPendingDeletes,
  getLastSyncTime,
  getPendingProfileUpdate,
  setPendingProfileUpdate,
  clearPendingProfileUpdate,
} from "../lib/storage";
import { IUserProfile, ITransaction, IWorkflow, ILocalBalance, CreateTransactionPayload, CreateWorkflowPayload, UpdateTransactionPayload } from "../lib/types";
import { generateTempId } from "../lib/utils";
import { notificationService } from "../lib/notifications";

function dedupeTransactions(items: ITransaction[]) {
  const deduped = new Map<string, ITransaction>();

  for (const item of items) {
    const key = item.clientRequestId || item._id;
    const existing = deduped.get(key);

    if (!existing || (existing.isLocal && !item.isLocal)) {
      deduped.set(key, item);
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

function dedupeWorkflows(items: IWorkflow[]) {
  const deduped = new Map<string, IWorkflow>();

  for (const item of items) {
    const existing = deduped.get(item._id);

    if (!existing || (existing.isLocal && !item.isLocal)) {
      deduped.set(item._id, item);
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime()
  );
}

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
  updateTransaction: (
    id: string,
    data: UpdateTransactionPayload
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
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [profile, setProfile] = useState<IUserProfile | null>(null);
  const [transactions, setTransactions] = useState<ITransaction[]>([]);
  const [workflows, setWorkflows] = useState<IWorkflow[]>([]);
  const [localBalances, setLocalBalancesState] = useState<ILocalBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTimeState] = useState<number | null>(null);
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setAuthTimedOut(false);
      return;
    }

    const timeout = setTimeout(() => {
      setAuthTimedOut(true);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isLoaded]);

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
      setLastSyncTimeState(status.lastSyncTime);

      // Refresh local state after sync completes
      if (!status.isSyncing) {
        await loadLocalData();
      }
    });

    return () => unsubscribe();
  }, []);

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
      const [
        storedProfile,
        storedTxns,
        storedWorkflows,
        pendingTxns,
        pendingWorkflows,
        pendingDeletes,
        pendingProfile,
        storedBalances,
        liveBalances,
        lastSync,
      ] =
        await Promise.all([
          getStoredProfile(),
          getStoredTransactions(),
          getStoredWorkflows(),
          getPendingTransactions(),
          getPendingWorkflows(),
          getPendingDeletes(),
          getPendingProfileUpdate(),
          getStoredLocalBalances(),
          getLocalBalances(),
          getLastSyncTime(),
        ]);

      const pendingTransactionDeletes = new Set(
        pendingDeletes
          .filter((item) => item.type === "transaction")
          .map((item) => item.id)
      );
      const pendingWorkflowDeletes = new Set(
        pendingDeletes
          .filter((item) => item.type === "workflow")
          .map((item) => item.id)
      );

      const visibleStoredTransactions = storedTxns.filter(
        (txn) => !pendingTransactionDeletes.has(txn._id)
      );
      const visiblePendingTransactions = pendingTxns.filter(
        (txn) => !pendingTransactionDeletes.has(txn._id)
      );
      const visibleStoredWorkflows = storedWorkflows.filter(
        (workflow) => !pendingWorkflowDeletes.has(workflow._id)
      );
      const visiblePendingWorkflows = pendingWorkflows.filter(
        (workflow) => !pendingWorkflowDeletes.has(workflow._id)
      );

      const hydratedProfile =
        storedProfile && pendingProfile ? { ...storedProfile, ...pendingProfile } : storedProfile;

      setProfile(hydratedProfile ?? null);
      setTransactions(
        dedupeTransactions([
          ...visiblePendingTransactions,
          ...visibleStoredTransactions,
        ])
      );
      setWorkflows(
        dedupeWorkflows([
          ...visiblePendingWorkflows,
          ...visibleStoredWorkflows,
        ])
      );
      setPendingCount(
        pendingTxns.length +
          pendingWorkflows.length +
          pendingDeletes.length +
          (pendingProfile ? 1 : 0)
      );
      setLastSyncTimeState(lastSync);
      setLocalBalancesState(
        storedBalances ?? (hydratedProfile ? hydratedProfile.balances : liveBalances)
      );

      return {
        hasRenderableData:
          Boolean(hydratedProfile) ||
          visibleStoredTransactions.length > 0 ||
          visibleStoredWorkflows.length > 0 ||
          visiblePendingTransactions.length > 0 ||
          visiblePendingWorkflows.length > 0,
      };
    } catch (error) {
      console.error("[UserContext] Error loading local data:", error);
      return { hasRenderableData: false };
    }
  }, []);

  // Initialize data on mount - OFFLINE FIRST
  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      if (isLoaded && !isSignedIn) {
        setProfile(null);
        setTransactions([]);
        setWorkflows([]);
        setLocalBalancesState(null);
        setPendingCount(0);
        setLastSyncTimeState(null);
        setLoading(false);
        return;
      }

      if (!isLoaded && !authTimedOut) {
        return;
      }

      setLoading(true);

      // Step 1: Hydrate cached data first
      const localSnapshot = await loadLocalData();
      if (cancelled) return;
      if (localSnapshot.hasRenderableData) {
        setLoading(false);
      }

      // Step 2: Initialize sync service + notifications
      await syncService.initialize();
      notificationService.initialize().catch(console.error);

      // Step 3: Reconcile with the server when possible
      try {
        if (!isLoaded || !isSignedIn) {
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }

        const online = await syncService.isOnline();
        if (!online) {
          console.log("[UserContext] Offline on launch - staying on cached data");
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }

        await syncService.syncAll();
        await loadLocalData();
      } catch (error) {
        console.log("[UserContext] Offline - using cached data:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
      syncService.cleanup();
      notificationService.cleanup();
    };
  }, [authTimedOut, isLoaded, isSignedIn, loadLocalData]);

  const refreshProfile = useCallback(async () => {
    try {
      await syncService.fetchProfile();
      await loadLocalData();
    } catch (error) {
      console.error("[UserContext] Error refreshing profile:", error);
    }
  }, [loadLocalData]);

  const refreshTransactions = useCallback(async () => {
    try {
      await syncService.fetchTransactions();
      await loadLocalData();
    } catch (error) {
      console.error("[UserContext] Error refreshing transactions:", error);
    }
  }, [loadLocalData]);

  const refreshWorkflows = useCallback(async () => {
    try {
      await syncService.fetchWorkflows();
      await loadLocalData();
    } catch (error) {
      console.error("[UserContext] Error refreshing workflows:", error);
    }
  }, [loadLocalData]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshProfile(), refreshTransactions(), refreshWorkflows()]);
  }, [refreshProfile, refreshTransactions, refreshWorkflows]);

  // Manual refresh button handler - forces a full sync + fetch
  const manualRefresh = useCallback(async () => {
    setSyncing(true);
    try {
      await syncService.forceRefresh();
    } catch (error) {
      console.error("[UserContext] Manual refresh failed:", error);
    } finally {
      await loadLocalData();
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
          await clearPendingProfileUpdate();
          setLocalBalancesState(updated.balances);
        } else {
          // Update locally
          if (profile) {
            const updated = { ...profile, ...data };
            setProfile(updated);
            await setStoredProfile(updated);
            const existingPending = await getPendingProfileUpdate();
            await setPendingProfileUpdate({
              ...(existingPending ?? {}),
              ...data,
            });
            if (updated.balances) {
              setLocalBalancesState(updated.balances);
            }
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
      const clientRequestId = generateTempId();
      const now = payload.date || new Date().toISOString();

      const tempTransaction: ITransaction = {
        _id: clientRequestId,
        clerkId: profile?.clerkId || "",
        clientRequestId,
        type: payload.type,
        amount: payload.amount,
        description: payload.description,
        category: payload.category,
        paymentMethod: payload.paymentMethod,
        splitAmount: payload.splitAmount || 0,
        date: now,
        createdAt: now,
        updatedAt: now,
        isLocal: true,
        syncStatus: "pending",
      };

      setTransactions((prev) => dedupeTransactions([tempTransaction, ...prev]));

      const newBalances = await syncService.applyLocalTransactionImpact(
        tempTransaction,
        1
      );
      setLocalBalancesState(newBalances);

      if (online) {
        try {
          const created = await api.createTransaction({
            ...payload,
            date: now,
            clientRequestId,
          });
          const storedTransactions = await getStoredTransactions();
          await setStoredTransactions(
            dedupeTransactions([created, ...storedTransactions])
          );
          setTransactions((prev) =>
            dedupeTransactions(
              prev.map((t) => (t._id === tempTransaction._id ? created : t))
            )
          );
          await refreshProfile();
          return;
        } catch (error) {
          console.log("[UserContext] Failed immediate transaction sync, queueing:", error);
        }
      }

      await addPendingTransaction(tempTransaction);
      setPendingCount((prev) => {
        notificationService.onPendingItemAdded(prev + 1);
        return prev + 1;
      });
    },
    [profile, refreshProfile]
  );

  const updateTransaction = useCallback(
    async (id: string, payload: UpdateTransactionPayload) => {
      const online = await syncService.isOnline();
      const isTemp = id.startsWith("temp_");

      // For local/temp transactions, we can't update them easily
      // They'll be synced and then can be edited
      if (isTemp) {
        throw new Error("Cannot edit pending transactions. Please wait for sync.");
      }

      if (!online) {
        throw new Error("Cannot edit transactions while offline");
      }

      try {
        // Update on server
        const updated = await api.updateTransaction(id, payload);
        
        // Update local state
        setTransactions((prev) =>
          prev.map((t) => (t._id === id ? updated : t))
        );
        const storedTransactions = await getStoredTransactions();
        await setStoredTransactions(
          dedupeTransactions(
            storedTransactions.map((t) => (t._id === id ? updated : t))
          )
        );
        
        // Refresh profile to get updated balances
        await refreshProfile();
      } catch (error) {
        console.error("[UserContext] Error updating transaction:", error);
        throw error;
      }
    },
    [refreshProfile]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const online = await syncService.isOnline();
      const isTemp = id.startsWith("temp_");
      const transaction = transactions.find((t) => t._id === id);

      setTransactions((prev) => prev.filter((t) => t._id !== id));
      const storedTransactions = await getStoredTransactions();
      await setStoredTransactions(storedTransactions.filter((t) => t._id !== id));
      if (transaction) {
        const nextBalances = await syncService.applyLocalTransactionImpact(
          transaction,
          -1
        );
        setLocalBalancesState(nextBalances);
      }

      if (isTemp) {
        await removePendingTransaction(id);
        setPendingCount((prev) => Math.max(0, prev - 1));
      } else if (online) {
        try {
          await api.deleteTransaction(id);
          await refreshProfile();
        } catch (error) {
          console.error("[UserContext] Error deleting transaction:", error);
          if (transaction) {
            await setStoredTransactions(
              dedupeTransactions([transaction, ...(await getStoredTransactions())])
            );
            setTransactions((prev) => dedupeTransactions([transaction, ...prev]));
            const restoredBalances = await syncService.applyLocalTransactionImpact(
              transaction,
              1
            );
            setLocalBalancesState(restoredBalances);
          }
          throw error;
        }
      } else {
        await addPendingDelete({ type: "transaction", id });
        setPendingCount((prev) => {
          notificationService.onPendingItemAdded(prev + 1);
          return prev + 1;
        });
      }
    },
    [refreshProfile, transactions]
  );

  const addWorkflow = useCallback(
    async (payload: CreateWorkflowPayload) => {
      const online = await syncService.isOnline();

      // Always save locally first
      const tempWorkflow: IWorkflow = {
        _id: generateTempId(),
        userId: profile?.clerkId || "",
        clientRequestId: generateTempId(),
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
          const created = await api.createWorkflow({
            ...payload,
            clientRequestId: tempWorkflow.clientRequestId,
          });
          await removePendingWorkflow(tempWorkflow._id);
          const storedWorkflows = await getStoredWorkflows();
          await setStoredWorkflows(
            dedupeWorkflows([created, ...storedWorkflows])
          );
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
    const workflow = workflows.find((w) => w._id === id);

    setWorkflows((prev) => prev.filter((w) => w._id !== id));
    const storedWorkflows = await getStoredWorkflows();
    await setStoredWorkflows(storedWorkflows.filter((w) => w._id !== id));

    if (isTemp) {
      // Just remove from pending (already handled by filter)
      await removePendingWorkflow(id);
      setPendingCount((prev) => Math.max(0, prev - 1));
    } else if (online) {
      try {
        await api.deleteWorkflow(id);
      } catch (error) {
        console.error("[UserContext] Error deleting workflow:", error);
        if (workflow) {
          await setStoredWorkflows(
            dedupeWorkflows([workflow, ...(await getStoredWorkflows())])
          );
          setWorkflows((prev) => dedupeWorkflows([workflow, ...prev]));
        }
        throw error;
      }
    } else {
      await addPendingDelete({ type: "workflow", id });
      setPendingCount((prev) => {
        notificationService.onPendingItemAdded(prev + 1);
        return prev + 1;
      });
    }
  }, [workflows]);

  const getBalance = useCallback(
    (method: "bank" | "cash" | "splitwise") => {
      const localValue = localBalances?.[method];
      const profileValue = profile?.balances?.[method];

      if (typeof localValue === "number") {
        return localValue;
      }

      if (typeof profileValue === "number") {
        return profileValue;
      }

      return 0;
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
        updateTransaction,
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
