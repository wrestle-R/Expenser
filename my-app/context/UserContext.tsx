import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "@clerk/clerk-expo";
import { api } from "../lib/api";
import { syncService } from "../lib/sync";
import {
  getStoredProfile,
  setStoredProfile,
  getStoredTransactions,
  setStoredTransactions,
  addPendingTransaction,
  getStoredWorkflows,
  setStoredWorkflows,
  addPendingWorkflow,
  addPendingDelete,
  getLocalBalances,
  setLocalBalances,
  getPendingTransactions,
  getPendingWorkflows,
} from "../lib/storage";
import { IUserProfile, ITransaction, IWorkflow, ILocalBalance } from "../lib/types";
import { generateTempId } from "../lib/utils";

interface UserContextType {
  profile: IUserProfile | null;
  transactions: ITransaction[];
  workflows: IWorkflow[];
  loading: boolean;
  syncing: boolean;
  isOnline: boolean;
  pendingCount: number;
  refreshProfile: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshWorkflows: () => Promise<void>;
  refreshAll: () => Promise<void>;
  updateProfile: (data: Partial<IUserProfile>) => Promise<void>;
  addTransaction: (
    data: Omit<ITransaction, "_id" | "clerkId" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addWorkflow: (
    data: Omit<IWorkflow, "_id" | "userId" | "createdAt" | "updatedAt">
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

  // Set API token when auth changes
  useEffect(() => {
    async function setApiToken() {
      if (isSignedIn) {
        try {
          const token = await getToken();
          api.setToken(token);
        } catch (error) {
          console.error("[UserContext] Error getting token:", error);
        }
      } else {
        api.setToken(null);
      }
    }
    setApiToken();
  }, [isSignedIn, getToken]);

  // Subscribe to sync status changes
  useEffect(() => {
    const unsubscribe = syncService.subscribe(async (status) => {
      setIsOnline(status.isOnline);
      setSyncing(status.isSyncing);
      setPendingCount(status.pendingCount);

      // Refresh data after sync completes
      if (!status.isSyncing && status.isOnline) {
        await loadLocalData();
      }
    });

    return () => unsubscribe();
  }, []);

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

  // Initialize data on mount
  useEffect(() => {
    async function initialize() {
      if (!isSignedIn) {
        setLoading(false);
        return;
      }

      setLoading(true);
      await loadLocalData();

      // Initialize sync service and attempt sync
      syncService.initialize();
      
      // Try to fetch from server
      try {
        const [serverTxns, serverWorkflows, serverProfile] = await Promise.all([
          syncService.fetchTransactions(),
          syncService.fetchWorkflows(),
          syncService.fetchProfile(),
        ]);

        if (serverProfile) setProfile(serverProfile);
        setTransactions(serverTxns);
        setWorkflows(serverWorkflows);
      } catch (error) {
        console.log("[UserContext] Using local data:", error);
      }

      setLoading(false);
    }

    initialize();

    return () => {
      syncService.cleanup();
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
    async (
      data: Omit<ITransaction, "_id" | "clerkId" | "createdAt" | "updatedAt">
    ) => {
      const online = await syncService.isOnline();

      if (online) {
        try {
          const created = await api.createTransaction(data);
          setTransactions((prev) => [created, ...prev]);
          await refreshProfile(); // Refresh to get updated balances
        } catch (error) {
          console.error("[UserContext] Error creating transaction:", error);
          throw error;
        }
      } else {
        // Create locally
        const tempTransaction: ITransaction = {
          _id: generateTempId(),
          clerkId: profile?.clerkId || "",
          ...data,
          date: data.date || new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isLocal: true,
          syncStatus: "pending",
        };

        await addPendingTransaction(tempTransaction);
        setTransactions((prev) => [tempTransaction, ...prev]);

        // Update local balance
        const newBalances = await syncService.updateLocalBalance(
          data.paymentMethod,
          data.amount,
          data.type,
          data.splitAmount
        );
        setLocalBalancesState(newBalances);
        
        // Update pending count
        setPendingCount((prev) => prev + 1);
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
        setPendingCount((prev) => prev + 1);
      }
    },
    [refreshProfile]
  );

  const addWorkflow = useCallback(
    async (data: Omit<IWorkflow, "_id" | "userId" | "createdAt" | "updatedAt">) => {
      const online = await syncService.isOnline();

      if (online) {
        try {
          const created = await api.createWorkflow(data);
          setWorkflows((prev) => [created, ...prev]);
        } catch (error) {
          console.error("[UserContext] Error creating workflow:", error);
          throw error;
        }
      } else {
        const tempWorkflow: IWorkflow = {
          _id: generateTempId(),
          userId: profile?.clerkId || "",
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isLocal: true,
          syncStatus: "pending",
        };

        await addPendingWorkflow(tempWorkflow);
        setWorkflows((prev) => [tempWorkflow, ...prev]);
        setPendingCount((prev) => prev + 1);
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
      setPendingCount((prev) => prev + 1);
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
        refreshProfile,
        refreshTransactions,
        refreshWorkflows,
        refreshAll,
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
