import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AppState, type AppStateStatus } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { syncService } from "../lib/sync";
import {
  addStoredBankReviewEvent,
  enqueueOutbox,
  getStoredProfile,
  getStoredStealthMode,
  getStoredTransactions,
  getStoredWorkflows,
  setStoredProfile,
  setStoredTransactions,
  setStoredWorkflows,
} from "../lib/storage";
import type {
  CreateTransactionPayload,
  CreateWorkflowPayload,
  ITransaction,
  IUserProfile,
  IWorkflow,
  ParsedBankNotificationResponse,
  PaymentMethod,
  UpdateTransactionPayload,
} from "../lib/types";
import { generateTempId } from "../lib/utils";
import { notificationService } from "../lib/notifications";
import {
  bankImportToTransactionPayload,
  addBankImportQueuedListener,
  clearQueuedBankImports,
  clearQueuedRawBankImportCandidates,
  getQueuedBankImports,
  getQueuedRawBankImportCandidates,
} from "../lib/bank-imports";
import { getPendingReviewStatus } from "../lib/transaction-review";

function dedupeTransactions(items: ITransaction[]) {
  const deduped = new Map<string, ITransaction>();
  for (const item of items) {
    if (item.deletedAt) continue;
    const key =
      item.importSource && item.importSourceKey
        ? `${item.importSource}:${item.importSourceKey}`
        : item.clientRequestId || item._id;
    deduped.set(key, item);
  }
  return [...deduped.values()].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

function dedupeWorkflows(items: IWorkflow[]) {
  return [...new Map(items.map((item) => [item._id, item])).values()].sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime()
  );
}

function parsedResponsePayload(
  response: Extract<ParsedBankNotificationResponse, { kind: "transaction" }>
): CreateTransactionPayload {
  return {
    type: response.parsed.type,
    amount: response.parsed.amount,
    description: response.parsed.payee ?? "",
    category: "",
    paymentMethod: "bank",
    splitAmount: 0,
    date: response.parsed.occurredAt,
    importSource: response.importSource,
    importSourceKey: response.importSourceKey,
    importedAccountSuffix: response.parsed.accountSuffix,
    importedBankBalance: response.parsed.availableBalance ?? undefined,
    importedBankReference: response.parsed.referenceNumber ?? undefined,
    importedBankConfidence: response.parsed.confidence,
  };
}

function signedAmount(transaction: ITransaction) {
  return transaction.type === "income" ? transaction.amount : -transaction.amount;
}

function deriveBalances(profile: IUserProfile | null, transactions: ITransaction[]) {
  if (!profile?.balanceAccounts?.length) {
    return profile?.balances ?? { bank: 0, cash: 0, splitwise: 0 };
  }

  const account = (method: PaymentMethod) =>
    profile.balanceAccounts.find((item) => item.paymentMethod === method);
  const afterOpening = (transaction: ITransaction, method: PaymentMethod) => {
    const openingAt = account(method)?.openingAt;
    return !openingAt || new Date(transaction.date) > new Date(openingAt);
  };
  const active = transactions.filter((item) => !item.deletedAt);
  const total = (method: PaymentMethod) =>
    active
      .filter((item) => item.paymentMethod === method && afterOpening(item, method))
      .reduce((sum, item) => sum + signedAmount(item), 0);

  const bankOpening = account("bank")?.openingBalance ?? 0;
  const bankAnchors = active
    .filter(
      (item) =>
        item.paymentMethod === "bank" &&
        item.importSource &&
        item.importedBankBalance != null &&
        afterOpening(item, "bank")
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestAnchor = bankAnchors[0];
  const bank = latestAnchor
    ? Number(latestAnchor.importedBankBalance) +
      active
        .filter(
          (item) =>
            item.paymentMethod === "bank" &&
            !item.importSource &&
            new Date(item.date) > new Date(latestAnchor.date)
        )
        .reduce((sum, item) => sum + signedAmount(item), 0)
    : bankOpening + total("bank");
  const splitReceivables = active
    .filter((item) => item.type === "expense" && afterOpening(item, "splitwise"))
    .reduce((sum, item) => sum + Math.max(0, Number(item.splitAmount || 0)), 0);

  return {
    bank,
    cash: (account("cash")?.openingBalance ?? 0) + total("cash"),
    splitwise:
      (account("splitwise")?.openingBalance ?? 0) +
      total("splitwise") +
      splitReceivables,
  };
}

interface UserContextType {
  profile: IUserProfile | null;
  transactions: ITransaction[];
  workflows: IWorkflow[];
  loading: boolean;
  syncing: boolean;
  isOnline: boolean;
  refreshProfile: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshWorkflows: () => Promise<void>;
  refreshAll: () => Promise<void>;
  manualRefresh: () => Promise<void>;
  updateProfile: (data: Partial<IUserProfile>) => Promise<void>;
  addTransaction: (data: CreateTransactionPayload) => Promise<void>;
  updateTransaction: (id: string, data: UpdateTransactionPayload) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addWorkflow: (data: CreateWorkflowPayload) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  getBalance: (method: PaymentMethod) => number;
  getTotalBalance: () => number;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [profile, setProfile] = useState<IUserProfile | null>(null);
  const [transactions, setTransactions] = useState<ITransaction[]>([]);
  const [workflows, setWorkflows] = useState<IWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(syncService.isOnlineSync());
  const bankImportDrainRef = useRef<(() => void) | null>(null);
  const rawRetryAttemptRef = useRef(0);
  const rawRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSignedIn = Boolean(session?.user);

  const loadLocalData = useCallback(async () => {
    const [storedProfile, storedTransactions, storedWorkflows] = await Promise.all([
      getStoredProfile(),
      getStoredTransactions(),
      getStoredWorkflows(),
    ]);
    setProfile(storedProfile);
    setTransactions(dedupeTransactions(storedTransactions));
    setWorkflows(dedupeWorkflows(storedWorkflows));
    return Boolean(storedProfile || storedTransactions.length || storedWorkflows.length);
  }, []);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoaded(true);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      api.setTokenGetter(async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      });
      api.setToken(session?.access_token ?? null);
    } else {
      api.setToken(null);
      api.setTokenGetter(null);
    }
  }, [isSignedIn, session?.access_token]);

  useEffect(() =>
    syncService.subscribe((status) => {
      setIsOnline(status.isOnline);
      setSyncing(status.isSyncing);
      if (status.error) {
        Alert.alert(
          "Change could not be uploaded",
          `${status.error}\n\nThe server version has been restored.`,
        );
      }
      if (!status.isSyncing) void loadLocalData();
    }), [loadLocalData]);

  useEffect(() => {
    const listener = (state: AppStateStatus) => {
      if (state === "active" && isSignedIn) {
        void syncService.syncAll();
        bankImportDrainRef.current?.();
      }
    };
    const subscription = AppState.addEventListener("change", listener);
    return () => subscription.remove();
  }, [isSignedIn]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!authLoaded) return;
      setLoading(true);
      await loadLocalData();
      await syncService.initialize();
      await notificationService.initialize();
      if (isSignedIn) await syncService.syncAll();
      if (!cancelled) {
        await loadLocalData();
        setLoading(false);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      syncService.cleanup();
      notificationService.cleanup();
    };
  }, [authLoaded, isSignedIn, loadLocalData]);

  const refreshProfile = useCallback(async () => {
    await syncService.fetchProfile();
    await loadLocalData();
  }, [loadLocalData]);
  const refreshTransactions = useCallback(async () => {
    await syncService.fetchTransactions();
    await loadLocalData();
  }, [loadLocalData]);
  const refreshWorkflows = useCallback(async () => {
    await syncService.fetchWorkflows();
    await loadLocalData();
  }, [loadLocalData]);
  const refreshAll = useCallback(async () => {
    await syncService.forceRefresh();
    await loadLocalData();
  }, [loadLocalData]);
  const manualRefresh = refreshAll;

  const updateProfile = useCallback(async (data: Partial<IUserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...data };
    setProfile(updated);
    await setStoredProfile(updated);
    await enqueueOutbox({
      entity: "profile",
      entityId: "current",
      action: "update",
      payload: data as Record<string, unknown>,
    });
    void syncService.syncAll();
  }, [profile]);

  const addTransaction = useCallback(async (payload: CreateTransactionPayload) => {
    const storedTransactions = await getStoredTransactions();
    if (
      payload.importSource &&
      payload.importSourceKey &&
      storedTransactions.some(
        (item) =>
          item.importSource === payload.importSource &&
          item.importSourceKey === payload.importSourceKey
      )
    ) {
      return;
    }
    const clientRequestId = payload.clientRequestId || generateTempId();
    const now = payload.date || new Date().toISOString();
    const normalizedPayload = {
      ...payload,
      clientRequestId,
      description: payload.description?.trim() ?? "",
      category: payload.category?.trim() ?? "",
      date: now,
    };
    const transaction: ITransaction = {
      _id: clientRequestId,
      userId: profile?.userId ?? "",
      ...normalizedPayload,
      reviewStatus: getPendingReviewStatus(normalizedPayload),
      splitAmount: normalizedPayload.splitAmount || 0,
      createdAt: now,
      updatedAt: now,
    };
    const next = dedupeTransactions([transaction, ...storedTransactions]);
    setTransactions(next);
    await setStoredTransactions(next);
    await enqueueOutbox({
      entity: "transaction",
      entityId: transaction._id,
      action: "create",
      payload: transaction as unknown as Record<string, unknown>,
    });

    if (transaction.importSourceKey) {
      await notificationService.notifyImportedTransaction({
        importSourceKey: transaction.importSourceKey,
        amount: transaction.amount,
        type: transaction.type,
        stealthMode: await getStoredStealthMode(),
      });
    }
    void syncService.syncAll();
  }, [profile?.userId]);

  const updateTransaction = useCallback(async (id: string, payload: UpdateTransactionPayload) => {
    const existing = transactions.find((item) => item._id === id);
    if (!existing) throw new Error("Transaction not found");
    const updated: ITransaction = {
      ...existing,
      ...payload,
      description: payload.description?.trim() ?? existing.description ?? "",
      category: payload.category?.trim() ?? existing.category,
      reviewStatus: getPendingReviewStatus({ ...existing, ...payload }),
      updatedAt: new Date().toISOString(),
    };
    const next = dedupeTransactions(transactions.map((item) => item._id === id ? updated : item));
    setTransactions(next);
    await setStoredTransactions(next);
    await enqueueOutbox({
      entity: "transaction",
      entityId: id,
      action: "update",
      payload: payload as Record<string, unknown>,
    });
    void syncService.syncAll();
  }, [transactions]);

  const deleteTransaction = useCallback(async (id: string) => {
    const next = transactions.filter((item) => item._id !== id);
    setTransactions(next);
    await setStoredTransactions(next);
    await enqueueOutbox({ entity: "transaction", entityId: id, action: "delete" });
    void syncService.syncAll();
  }, [transactions]);

  const importQueuedBankNotifications = useCallback(async () => {
    if (!isSignedIn || !profile) return;

    const importedKeys: string[] = [];
    for (const item of getQueuedBankImports()) {
      try {
        await addTransaction(bankImportToTransactionPayload(item));
        importedKeys.push(item.importSourceKey);
      } catch (error) {
        console.error("[Bank import] Failed parsed candidate:", error);
      }
    }
    if (importedKeys.length) clearQueuedBankImports(importedKeys);

    const clearedRawKeys: string[] = [];
    let rawFailure = false;
    for (const item of getQueuedRawBankImportCandidates()) {
      try {
        const response = await api.parseBankNotification(item.message);
        if (response.kind === "transaction") {
          await addTransaction(parsedResponsePayload(response));
        } else if (response.kind === "review_event") {
          await addStoredBankReviewEvent({
            ...response.event,
            importSource: response.importSource,
            importSourceKey: response.importSourceKey,
            capturedAt: item.capturedAt,
            notificationPackage: item.notificationPackage,
            parser: response.parser,
          });
        } else {
          await addStoredBankReviewEvent({
            bankName: "Union Bank of India",
            eventType: "unparsed_union_bank_notification",
            amount: null,
            accountSuffix: null,
            occurredAt: item.capturedAt,
            summary: "Union Bank notification needs review",
            confidence: "low",
            importSource: "union_bank_event",
            importSourceKey: `union-bank:event:raw:${item.sourceKey}`,
            capturedAt: item.capturedAt,
            notificationPackage: item.notificationPackage,
            parser: response.parser,
          });
        }
        clearedRawKeys.push(item.sourceKey);
      } catch (error) {
        rawFailure = true;
        console.error("[Bank import] Raw candidate retained for retry:", error);
      }
    }
    if (clearedRawKeys.length) clearQueuedRawBankImportCandidates(clearedRawKeys);
    if (rawFailure) {
      rawRetryAttemptRef.current += 1;
      const delay = Math.min(60_000, 2_000 * 2 ** (rawRetryAttemptRef.current - 1));
      if (rawRetryTimerRef.current) clearTimeout(rawRetryTimerRef.current);
      rawRetryTimerRef.current = setTimeout(
        () => bankImportDrainRef.current?.(),
        delay
      );
    } else {
      rawRetryAttemptRef.current = 0;
      if (rawRetryTimerRef.current) clearTimeout(rawRetryTimerRef.current);
      rawRetryTimerRef.current = null;
    }
  }, [addTransaction, isSignedIn, profile]);

  useEffect(() => {
    bankImportDrainRef.current = () => void importQueuedBankNotifications();
    if (isSignedIn && profile) void importQueuedBankNotifications();
    const subscription = addBankImportQueuedListener(() => {
      if (isSignedIn && profile) void importQueuedBankNotifications();
    });
    return () => {
      subscription.remove();
      bankImportDrainRef.current = null;
      if (rawRetryTimerRef.current) clearTimeout(rawRetryTimerRef.current);
    };
  }, [importQueuedBankNotifications, isSignedIn, profile]);

  const addWorkflow = useCallback(async (payload: CreateWorkflowPayload) => {
    const id = generateTempId();
    const now = new Date().toISOString();
    const workflow: IWorkflow = {
      _id: id,
      userId: profile?.userId ?? "",
      clientRequestId: id,
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
    const next = dedupeWorkflows([workflow, ...workflows]);
    setWorkflows(next);
    await setStoredWorkflows(next);
    await enqueueOutbox({
      entity: "workflow",
      entityId: id,
      action: "create",
      payload: workflow as unknown as Record<string, unknown>,
    });
    void syncService.syncAll();
  }, [profile?.userId, workflows]);

  const deleteWorkflow = useCallback(async (id: string) => {
    const next = workflows.filter((item) => item._id !== id);
    setWorkflows(next);
    await setStoredWorkflows(next);
    await enqueueOutbox({ entity: "workflow", entityId: id, action: "delete" });
    void syncService.syncAll();
  }, [workflows]);

  const balances = useMemo(
    () => deriveBalances(profile, transactions),
    [profile, transactions]
  );
  const getBalance = useCallback(
    (method: PaymentMethod) => balances[method] ?? 0,
    [balances]
  );
  const getTotalBalance = useCallback(
    () =>
      (profile?.paymentMethods ?? []).reduce(
        (sum, method) =>
          ["bank", "cash", "splitwise"].includes(method)
            ? sum + getBalance(method as PaymentMethod)
            : sum,
        0
      ),
    [getBalance, profile?.paymentMethods]
  );

  return (
    <UserContext.Provider
      value={{
        profile,
        transactions,
        workflows,
        loading,
        syncing,
        isOnline,
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
  if (!context) throw new Error("useUserContext must be used within UserProvider");
  return context;
}
