import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {useAuth} from '@clerk/clerk-expo';
import {api} from '../data/remote/api';
import {syncService} from '../data/sync/syncService';
import {
  ITransaction,
  IWorkflow,
  IUserProfile,
  ILocalBalance,
  CreateTransactionPayload,
  CreateWorkflowPayload,
} from '../domain/types';
import {generateTempId} from '../utils/helpers';
import {
  getStoredTransactions,
  setStoredTransactions,
  getStoredWorkflows,
  setStoredWorkflows,
  getStoredProfile,
  setStoredProfile,
  addPendingTransaction,
  addPendingWorkflow,
  getPendingTransactions,
  getPendingWorkflows,
  getPendingDeletes,
  addPendingDelete,
  getLocalBalances,
  setLocalBalances,
  clearAllData,
} from '../data/local/storage';
import {notificationService} from '../services/notifications';

interface UserContextType {
  // Data
  profile: IUserProfile | null;
  transactions: ITransaction[];
  workflows: IWorkflow[];
  balances: ILocalBalance;

  // Status
  loading: boolean;
  isOnline: boolean;
  syncing: boolean;
  pendingCount: number;

  // Actions
  addTransaction: (payload: CreateTransactionPayload) => Promise<void>;
  updateTransaction: (
    id: string,
    payload: Partial<CreateTransactionPayload>,
  ) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addWorkflow: (payload: CreateWorkflowPayload) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  updateProfile: (data: Partial<IUserProfile>) => Promise<void>;
  manualRefresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({} as UserContextType);

export function UserProvider({children}: {children: React.ReactNode}) {
  const {getToken, signOut: clerkSignOut} = useAuth();

  const [profile, setProfile] = useState<IUserProfile | null>(null);
  const [transactions, setTransactions] = useState<ITransaction[]>([]);
  const [workflows, setWorkflows] = useState<IWorkflow[]>([]);
  const [balances, setBalances] = useState<ILocalBalance>({
    bank: 0,
    cash: 0,
    splitwise: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const initializedRef = useRef(false);

  // ─── Token + Sync Setup ───
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    api.setTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });

    notificationService.initialize();

    syncService.subscribe(status => {
      setIsOnline(status.isOnline);
      setSyncing(status.isSyncing);
      setPendingCount(status.pendingCount);
    });

    syncService.initialize();
    loadLocalData();
  }, [getToken]);

  // ─── Load Local Data (cache-first) ───
  const loadLocalData = useCallback(async () => {
    try {
      console.log('[UserCtx] Loading local data...');
      const [
        storedProfile,
        storedTransactions,
        storedWorkflows,
        storedBalances,
        pendingTxns,
        pendingWorkflowsList,
        pendingDeletes,
      ] = await Promise.all([
        getStoredProfile(),
        getStoredTransactions(),
        getStoredWorkflows(),
        getLocalBalances(),
        getPendingTransactions(),
        getPendingWorkflows(),
        getPendingDeletes(),
      ]);

      if (storedProfile) setProfile(storedProfile);
      setBalances(storedBalances);

      // Merge pending + stored
      const pendingIds = new Set(pendingTxns.map(t => t._id));
      const allTxns = [
        ...pendingTxns,
        ...storedTransactions.filter(t => !pendingIds.has(t._id)),
      ];
      setTransactions(allTxns);

      const pendingWfIds = new Set(pendingWorkflowsList.map(w => w._id));
      const allWorkflows = [
        ...pendingWorkflowsList,
        ...storedWorkflows.filter(w => !pendingWfIds.has(w._id)),
      ];
      setWorkflows(allWorkflows);

      setPendingCount(
        pendingTxns.length + pendingWorkflowsList.length + pendingDeletes.length,
      );

      // Now try fetching from server (background)
      fetchServerData();
    } catch (error) {
      console.error('[UserCtx] Error loading local data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch from Server ───
  const fetchServerData = useCallback(async () => {
    try {
      const result = await syncService.fetchAllFromServer();
      if (result) {
        if (result.profile) {
          setProfile(result.profile);
        }

        const pendingTxns = await getPendingTransactions();
        const pendingWorkflowsList = await getPendingWorkflows();

        const pendingTxnIds = new Set(pendingTxns.map(t => t._id));
        setTransactions([
          ...pendingTxns,
          ...result.transactions.filter(t => !pendingTxnIds.has(t._id)),
        ]);

        const pendingWfIds = new Set(pendingWorkflowsList.map(w => w._id));
        setWorkflows([
          ...pendingWorkflowsList,
          ...result.workflows.filter(w => !pendingWfIds.has(w._id)),
        ]);

        if (pendingTxns.length === 0 && result.profile) {
          setBalances(result.profile.balances);
        }
      }
    } catch (error) {
      console.error('[UserCtx] Error fetching server data:', error);
    }
  }, []);

  // ─── Auto-refresh from sync events ───
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!syncing) return;

      const [storedTxns, storedWfs, pendingTxns, pendingWfs, storedProf, bal] =
        await Promise.all([
          getStoredTransactions(),
          getStoredWorkflows(),
          getPendingTransactions(),
          getPendingWorkflows(),
          getStoredProfile(),
          getLocalBalances(),
        ]);

      const pendingTxnIds = new Set(pendingTxns.map(t => t._id));
      setTransactions([
        ...pendingTxns,
        ...storedTxns.filter(t => !pendingTxnIds.has(t._id)),
      ]);

      const pendingWfIds = new Set(pendingWfs.map(w => w._id));
      setWorkflows([
        ...pendingWfs,
        ...storedWfs.filter(w => !pendingWfIds.has(w._id)),
      ]);

      if (storedProf) setProfile(storedProf);
      setBalances(bal);
    }, 2000);

    return () => clearInterval(interval);
  }, [syncing]);

  // ─── CRUD: Add Transaction ───
  const addTransactionFn = useCallback(
    async (payload: CreateTransactionPayload) => {
      const isOnlineNow = syncService.isOnlineSync();

      if (isOnlineNow) {
        try {
          const created = await api.createTransaction(payload);
          const freshTxns = await api.getTransactions();
          await setStoredTransactions(freshTxns);
          setTransactions(freshTxns);

          const freshProfile = await api.getProfile();
          if (freshProfile) {
            await setStoredProfile(freshProfile);
            setProfile(freshProfile);
            const pendingTxns = await getPendingTransactions();
            if (pendingTxns.length === 0) {
              setBalances(freshProfile.balances);
              await setLocalBalances(freshProfile.balances);
            }
          }
          return;
        } catch (error) {
          console.error(
            '[UserCtx] Online create failed, saving locally:',
            error,
          );
        }
      }

      // Offline path
      const tempTransaction: ITransaction = {
        _id: generateTempId(),
        clerkId: profile?.clerkId || '',
        type: payload.type,
        amount: payload.amount,
        description: payload.description,
        category: payload.category,
        paymentMethod: payload.paymentMethod,
        splitAmount: payload.splitAmount,
        date: payload.date || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLocal: true,
        syncStatus: 'pending',
      };

      await addPendingTransaction(tempTransaction);
      setTransactions(prev => [tempTransaction, ...prev]);

      const newBalances = await syncService.updateLocalBalance(
        payload.paymentMethod,
        payload.amount,
        payload.type,
        payload.splitAmount,
      );
      setBalances(newBalances);

      const pendingAll = await getPendingTransactions();
      const pendingWfsAll = await getPendingWorkflows();
      const pendingDelsAll = await getPendingDeletes();
      setPendingCount(
        pendingAll.length + pendingWfsAll.length + pendingDelsAll.length,
      );

      await notificationService.onPendingItemAdded(pendingAll.length);
    },
    [profile],
  );

  // ─── CRUD: Update Transaction ───
  const updateTransactionFn = useCallback(
    async (id: string, payload: Partial<CreateTransactionPayload>) => {
      const updated = await api.updateTransaction(id, payload);
      const freshTxns = await api.getTransactions();
      await setStoredTransactions(freshTxns);
      setTransactions(freshTxns);

      const freshProfile = await api.getProfile();
      if (freshProfile) {
        await setStoredProfile(freshProfile);
        setProfile(freshProfile);
        setBalances(freshProfile.balances);
        await setLocalBalances(freshProfile.balances);
      }
    },
    [],
  );

  // ─── CRUD: Delete Transaction ───
  const deleteTransactionFn = useCallback(async (id: string) => {
    const isOnlineNow = syncService.isOnlineSync();

    if (isOnlineNow) {
      try {
        await api.deleteTransaction(id);
        const freshTxns = await api.getTransactions();
        await setStoredTransactions(freshTxns);
        setTransactions(freshTxns);

        const freshProfile = await api.getProfile();
        if (freshProfile) {
          await setStoredProfile(freshProfile);
          setProfile(freshProfile);
          setBalances(freshProfile.balances);
          await setLocalBalances(freshProfile.balances);
        }
        return;
      } catch (error) {
        console.error(
          '[UserCtx] Online delete failed, queueing offline:',
          error,
        );
      }
    }

    // Offline delete
    await addPendingDelete({type: 'transaction', id});
    setTransactions(prev => prev.filter(t => t._id !== id));
  }, []);

  // ─── CRUD: Add Workflow ───
  const addWorkflowFn = useCallback(
    async (payload: CreateWorkflowPayload) => {
      const isOnlineNow = syncService.isOnlineSync();

      if (isOnlineNow) {
        try {
          await api.createWorkflow(payload);
          const freshWfs = await api.getWorkflows();
          await setStoredWorkflows(freshWfs);
          setWorkflows(freshWfs);
          return;
        } catch (error) {
          console.error(
            '[UserCtx] Online workflow create failed, saving locally:',
            error,
          );
        }
      }

      const tempWorkflow: IWorkflow = {
        _id: generateTempId(),
        userId: profile?.clerkId || '',
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
        syncStatus: 'pending',
      };

      await addPendingWorkflow(tempWorkflow);
      setWorkflows(prev => [tempWorkflow, ...prev]);
    },
    [profile],
  );

  // ─── CRUD: Delete Workflow ───
  const deleteWorkflowFn = useCallback(async (id: string) => {
    const isOnlineNow = syncService.isOnlineSync();

    if (isOnlineNow) {
      try {
        await api.deleteWorkflow(id);
        const freshWfs = await api.getWorkflows();
        await setStoredWorkflows(freshWfs);
        setWorkflows(freshWfs);
        return;
      } catch (error) {
        console.error(
          '[UserCtx] Online workflow delete failed, queueing:',
          error,
        );
      }
    }

    await addPendingDelete({type: 'workflow', id});
    setWorkflows(prev => prev.filter(w => w._id !== id));
  }, []);

  // ─── Update Profile ───
  const updateProfileFn = useCallback(
    async (data: Partial<IUserProfile>) => {
      const updated = await api.updateProfile(data);
      await setStoredProfile(updated);
      setProfile(updated);
    },
    [],
  );

  // ─── Manual Refresh ───
  const manualRefreshFn = useCallback(async () => {
    try {
      await syncService.syncAll();
      await fetchServerData();
    } catch (error) {
      console.error('[UserCtx] Manual refresh failed:', error);
    }
  }, [fetchServerData]);

  // ─── Sign Out ───
  const signOutFn = useCallback(async () => {
    try {
      syncService.cleanup();
      notificationService.cleanup();
      await clearAllData();
      await clerkSignOut();

      setProfile(null);
      setTransactions([]);
      setWorkflows([]);
      setBalances({bank: 0, cash: 0, splitwise: 0});
    } catch (error) {
      console.error('[UserCtx] Error signing out:', error);
    }
  }, [clerkSignOut]);

  return (
    <UserContext.Provider
      value={{
        profile,
        transactions,
        workflows,
        balances,
        loading,
        isOnline,
        syncing,
        pendingCount,
        addTransaction: addTransactionFn,
        updateTransaction: updateTransactionFn,
        deleteTransaction: deleteTransactionFn,
        addWorkflow: addWorkflowFn,
        deleteWorkflow: deleteWorkflowFn,
        updateProfile: updateProfileFn,
        manualRefresh: manualRefreshFn,
        signOut: signOutFn,
      }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within UserProvider');
  }
  return context;
}
