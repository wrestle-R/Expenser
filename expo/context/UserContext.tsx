import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { api } from "../lib/api";
import { supabase, initialSession } from "../lib/supabase";
import { syncService, type SyncStatus } from "../lib/sync";
import {
  addStoredBankReviewEvent,
  clearStoredBankReviewEvents,
  enqueueOutbox,
  saveTransactionChange,
  getStoredBankReviewEvents,
  getStoredProfile,
  getStoredStealthMode,
  getStoredTransactions,
  getStoredWorkflows,
  setStoredProfile,
  setStoredWorkflows,
} from "../lib/storage";
import type {
  BankImportStatus,
  BankReviewEvent,
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
  clearQueuedNativeBankReviewEvents,
  clearQueuedRawBankImportCandidates,
  getBankImportQueueSnapshot,
  getQueuedBankImports,
  getQueuedNativeBankReviewEvents,
  getQueuedRawBankImportCandidates,
} from "../lib/bank-imports";
import { getPendingReviewStatus } from "../lib/transaction-review";
import { withDefaultPaymentMethod } from "../lib/payment-methods.js";
import {
  createCoalescingDrain,
  processBankImportCandidate,
} from "../lib/bank-import-processing";
import {
  dedupeTransactions,
  optimisticAddTransaction,
  optimisticDeleteTransaction,
  optimisticUpdateTransaction,
} from "../lib/transaction-state.js";

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
    importedAccountSuffix: response.parsed.accountSuffix ?? undefined,
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

  const bank = (account("bank")?.openingBalance ?? 0) + total("bank");
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
  bankReviewEvents: BankReviewEvent[];
  bankImportStatus: BankImportStatus;
  loading: boolean;
  syncing: boolean;
  isOnline: boolean;
  syncStatus: SyncStatus;
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
  updateWorkflow: (id: string, data: CreateWorkflowPayload) => Promise<void>;
  dismissBankReviewEvent: (sourceKey: string) => Promise<void>;
  retryBankReviewEvent: (sourceKey: string) => Promise<void>;
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
  const [bankReviewEvents, setBankReviewEvents] = useState<BankReviewEvent[]>([]);
  const [bankImportStatus, setBankImportStatus] = useState<BankImportStatus>({
    queuedCandidates: 0,
    queuedNativeReviews: 0,
    localReviews: 0,
    retrying: false,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(syncService.isOnlineSync());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ isOnline: false, isSyncing: false, pendingChanges: 0, rejectedChanges: 0 });
  const transactionsRef = useRef<ITransaction[]>([]);
  const bankImportDrainRef = useRef<(() => void) | null>(null);
  const rawRetryAttemptRef = useRef(0);
  const rawRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSignedIn = Boolean(session?.user);

  const setTransactionSnapshot = useCallback((next: ITransaction[]) => {
    transactionsRef.current = next;
    setTransactions(next);
  }, []);

  const loadLocalData = useCallback(async () => {
    const [storedProfile, storedTransactions, storedWorkflows, storedReviewEvents] = await Promise.all([
      getStoredProfile(),
      getStoredTransactions(),
      getStoredWorkflows(),
      getStoredBankReviewEvents(),
    ]);
    setProfile(storedProfile);
    setTransactionSnapshot(dedupeTransactions(storedTransactions));
    setWorkflows(dedupeWorkflows(storedWorkflows));
    setBankReviewEvents(storedReviewEvents);
    const queue = getBankImportQueueSnapshot();
    setBankImportStatus((current) => ({
      ...current,
      queuedCandidates: queue.candidates,
      queuedNativeReviews: queue.reviewEvents,
      localReviews: storedReviewEvents.length,
    }));
    return Boolean(storedProfile || storedTransactions.length || storedWorkflows.length);
  }, [setTransactionSnapshot]);

  useEffect(() => {
    let mounted = true;
    let authChanged = false;
    void initialSession.then((cachedSession) => {
      if (!mounted || authChanged) return;
      setSession(cachedSession);
      setAuthLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authChanged = true;
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
      setSyncStatus(status);
      setIsOnline(status.isOnline);
      if (status.isOnline && !status.isSyncing) bankImportDrainRef.current?.();
      setSyncing(status.isSyncing);
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
      try {
        await loadLocalData();
        // Render saved data immediately. Connectivity and refresh run behind the screen.
        if (!cancelled) setLoading(false);
        await syncService.initialize();
        await notificationService.initialize();
        if (isSignedIn && !cancelled) await syncService.syncAll();
        if (!cancelled) await loadLocalData();
      } catch (error) {
        console.error("[User] Initialization failed", error instanceof Error ? error.name : "UnknownError");
      } finally {
        if (!cancelled) setLoading(false);
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
    const normalizedData = Array.isArray(data.paymentMethods)
      ? {
          ...data,
          paymentMethods: withDefaultPaymentMethod(data.paymentMethods),
        }
      : data;
    const updated = {
      ...profile,
      ...normalizedData,
      paymentMethods: withDefaultPaymentMethod(
        Array.isArray(normalizedData.paymentMethods)
          ? normalizedData.paymentMethods
          : profile.paymentMethods
      ),
    };
    setProfile(updated);
    await setStoredProfile(updated);
    await enqueueOutbox({
      entity: "profile",
      entityId: "current",
      action: "update",
      payload: normalizedData as Record<string, unknown>,
    });
    void syncService.syncAll();
  }, [profile]);

  const addTransaction = useCallback(async (payload: CreateTransactionPayload) => {
    const storedTransactions = transactionsRef.current;
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
    let inserted = true;
    const persisted = await saveTransactionChange({
      entityId: transaction._id, action: "create", payload: transaction as unknown as Record<string, unknown>,
    }, (current) => {
      if (current.some((item) => item.clientRequestId === transaction.clientRequestId ||
          (transaction.importSourceKey && item.importSourceKey === transaction.importSourceKey))) {
        inserted = false;
        return current;
      }
      return optimisticAddTransaction(current, transaction);
    });
    setTransactionSnapshot(persisted);
    if (!inserted) return;


    if (transaction.importSourceKey) {
      await notificationService.notifyImportedTransaction({
        importSourceKey: transaction.importSourceKey,
        amount: transaction.amount,
        type: transaction.type,
        stealthMode: await getStoredStealthMode(),
      });
    }
    void syncService.syncAll();
  }, [profile?.userId, setTransactionSnapshot]);

  const updateTransaction = useCallback(async (id: string, payload: UpdateTransactionPayload) => {
    const existing = transactionsRef.current.find((item) => item._id === id);
    if (!existing) throw new Error("Transaction not found");
    const updated: ITransaction = {
      ...existing,
      ...payload,
      description: payload.description?.trim() ?? existing.description ?? "",
      category: payload.category?.trim() ?? existing.category,
      reviewStatus: getPendingReviewStatus({ ...existing, ...payload }),
      updatedAt: new Date().toISOString(),
    };
    const persisted = await saveTransactionChange({ entityId: id, action: "update", payload: payload as Record<string, unknown> }, (current) =>
      optimisticUpdateTransaction(current, id, updated)
    );
    setTransactionSnapshot(persisted);
    void syncService.syncAll();
  }, [setTransactionSnapshot]);

  const deleteTransaction = useCallback(async (id: string) => {
    const persisted = await saveTransactionChange({ entityId: id, action: "delete" }, (current) =>
      optimisticDeleteTransaction(current, id)
    );
    setTransactionSnapshot(persisted);
    void syncService.syncAll();
  }, [setTransactionSnapshot]);

  const importQueuedBankNotifications = useCallback(async () => {
    if (!isSignedIn || !profile?.userId) return;

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

      let rawFailure = false;
      const clearedNativeReviewKeys: string[] = [];
      for (const item of getQueuedNativeBankReviewEvents()) {
        const saved = await addStoredBankReviewEvent(item);
        if (saved) {
          clearedNativeReviewKeys.push(item.importSourceKey);
        } else {
          rawFailure = true;
        }
      }
      if (clearedNativeReviewKeys.length) {
        clearQueuedNativeBankReviewEvents(clearedNativeReviewKeys);
      }

      const clearedRawKeys: string[] = [];
      for (const item of getQueuedRawBankImportCandidates()) {
        try {
          const envelope = {
            sourceKey: item.sourceKey,
            sender: item.sender,
            message: item.message,
            capturedAt: item.capturedAt,
            sourcePackage: item.sourcePackage || item.notificationPackage,
          };
          await processBankImportCandidate({
            candidate: envelope,
            parse: (envelope) => api.parseBankNotification(envelope, syncService.isOnlineSync()),
            queueTransaction: async (response) => {
              await addTransaction(parsedResponsePayload(response));
            },
            saveReview: async (response) => {
              if (response.kind === "review_event") {
                return addStoredBankReviewEvent({
                  ...response.event,
                  importSource: response.importSource,
                  importSourceKey: response.importSourceKey,
                  capturedAt: item.capturedAt,
                  notificationPackage: item.notificationPackage,
                  parser: response.parser,
                  rawMessage: item.message,
                  sender: item.sender,
                  sourcePackage: item.sourcePackage,
                  sourceKey: item.sourceKey,
                });
              }
              return addStoredBankReviewEvent({
                bankName: null,
                eventType: "unparsed_sms_notification",
                amount: null,
                accountSuffix: null,
                occurredAt: item.capturedAt,
                summary: "Transaction-like message needs review",
                confidence: "low",
                importSource: "sms_notification_review",
                importSourceKey: `sms:review:${item.sourceKey}`,
                capturedAt: item.capturedAt,
                notificationPackage: item.notificationPackage,
                parser: response.parser,
                rawMessage: item.message,
                sender: item.sender,
                sourcePackage: item.sourcePackage,
                sourceKey: item.sourceKey,
                failureReason: response.reason,
              });
            },
          });
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
      await loadLocalData();
      const queue = getBankImportQueueSnapshot();
      setBankImportStatus({
        queuedCandidates: queue.candidates,
        queuedNativeReviews: queue.reviewEvents,
        localReviews: (await getStoredBankReviewEvents()).length,
        retrying: rawFailure,
      });
  }, [addTransaction, isSignedIn, loadLocalData, profile?.userId]);

  const requestBankImportDrain = useMemo(
    () => createCoalescingDrain(importQueuedBankNotifications),
    [importQueuedBankNotifications]
  );

  const dismissBankReviewEvent = useCallback(async (sourceKey: string) => {
    await clearStoredBankReviewEvents([sourceKey]);
    await loadLocalData();
  }, [loadLocalData]);

  const retryBankReviewEvent = useCallback(async (sourceKey: string) => {
    const event = (await getStoredBankReviewEvents()).find(
      (item) => item.importSourceKey === sourceKey
    );
    if (!event?.rawMessage || !event.sourceKey) {
      throw new Error("This review item does not contain a retryable message.");
    }
    const response = await api.parseBankNotification({
      sourceKey: event.sourceKey,
      sender: event.sender ?? null,
      message: event.rawMessage,
      capturedAt: event.capturedAt ?? new Date().toISOString(),
      sourcePackage: event.sourcePackage ?? event.notificationPackage ?? "",
    }, syncService.isOnlineSync());
    if (response.kind === "transaction") {
      await addTransaction(parsedResponsePayload(response));
      await clearStoredBankReviewEvents([sourceKey]);
    } else if (response.kind === "non_transaction") {
      await clearStoredBankReviewEvents([sourceKey]);
    } else {
      const nextEvent: BankReviewEvent = response.kind === "review_event"
        ? {
            ...response.event,
            importSource: response.importSource,
            importSourceKey: sourceKey,
            parser: response.parser,
          }
        : {
            ...event,
            parser: response.parser,
            failureReason: response.reason,
          };
      const saved = await addStoredBankReviewEvent({
        ...nextEvent,
        rawMessage: event.rawMessage,
        sender: event.sender,
        sourcePackage: event.sourcePackage,
        sourceKey: event.sourceKey,
        capturedAt: event.capturedAt,
        notificationPackage: event.notificationPackage,
      });
      if (!saved) throw new Error("Review item could not be updated.");
    }
    await loadLocalData();
  }, [addTransaction, loadLocalData]);

  useEffect(() => {
    bankImportDrainRef.current = () => void requestBankImportDrain();
    if (isSignedIn && profile?.userId) void requestBankImportDrain();
    const subscription = addBankImportQueuedListener(() => {
      if (isSignedIn && profile?.userId) void requestBankImportDrain();
    });
    return () => {
      subscription.remove();
      bankImportDrainRef.current = null;
      if (rawRetryTimerRef.current) clearTimeout(rawRetryTimerRef.current);
    };
  }, [isSignedIn, profile?.userId, requestBankImportDrain]);

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

  const updateWorkflow = useCallback(async (id: string, payload: CreateWorkflowPayload) => {
    const stored = await getStoredWorkflows();
    const next = stored.map(item => item._id === id ? {...item,...payload,updatedAt:new Date().toISOString()} : item);
    await setStoredWorkflows(next);
    await enqueueOutbox({entity:"workflow",entityId:id,action:"update",payload:payload as unknown as Record<string,unknown>});
    setWorkflows(next);
    void syncService.syncAll();
  }, []);

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
        bankReviewEvents,
        bankImportStatus,
        loading,
        syncing,
        isOnline,
        syncStatus,
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
        updateWorkflow,
        deleteWorkflow,
        dismissBankReviewEvent,
        retryBankReviewEvent,
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
