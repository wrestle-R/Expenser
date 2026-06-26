import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { api } from "./src/api";
import {
  clearQueuedImports,
  getQueuedImports,
  isNotificationAccessEnabled,
  openNotificationAccessSettings,
  toTransactionPayload,
} from "./src/bankNotifications";
import { getSessionToken, loadAuthState, signInWithPassword, signInWithSessionToken, signOut } from "./src/auth";
import { money, paymentLabel, sortTransactions } from "./src/format";
import type { PaymentMethod, Transaction, TransactionPayload, TransactionType, UserCategory, UserProfile } from "./src/types";
import { getTransactionDisplayFields } from "./src/transactionReview";

type Tab = "dashboard" | "transactions" | "setup";
type Palette = ReturnType<typeof getPalette>;

const SETTINGS_KEY = "expenser-lite-settings";
const CATEGORY_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2"];

const emptyForm = {
  type: "expense" as TransactionType,
  amount: "",
  description: "",
  category: "other",
  paymentMethod: "bank" as PaymentMethod,
  date: new Date().toISOString().slice(0, 10),
};

function getPalette(isDark: boolean) {
  return isDark
    ? {
        bg: "#0b0f14",
        surface: "#121821",
        surfaceAlt: "#1a2330",
        border: "#2b3645",
        text: "#f4f7fb",
        muted: "#9caaba",
        primary: "#4f8cff",
        danger: "#ff6b6b",
        success: "#45c486",
        input: "#0f151d",
      }
    : {
        bg: "#f6f8fb",
        surface: "#ffffff",
        surfaceAlt: "#eef3f8",
        border: "#d9e1ea",
        text: "#121826",
        muted: "#65758a",
        primary: "#255fd5",
        danger: "#c73535",
        success: "#14845b",
        input: "#ffffff",
      };
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [stealth, setStealth] = useState(false);

  useEffect(() => {
    api.setTokenGetter(getSessionToken);
    Promise.all([loadAuthState(), AsyncStorage.getItem(SETTINGS_KEY)])
      .then(([authState, rawSettings]) => {
        setSignedIn(Boolean(authState?.sessionToken));
        if (rawSettings) {
          const settings = JSON.parse(rawSettings) as { isDark?: boolean; stealth?: boolean };
          setIsDark(Boolean(settings.isDark));
          setStealth(Boolean(settings.stealth));
        }
      })
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ isDark, stealth })).catch(() => {});
  }, [isDark, stealth]);

  const palette = useMemo(() => getPalette(isDark), [isDark]);

  if (booting) {
    return (
      <Shell palette={palette}>
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} />
        </View>
      </Shell>
    );
  }

  if (!signedIn) {
    return <SignInScreen palette={palette} isDark={isDark} setIsDark={setIsDark} onSignedIn={() => setSignedIn(true)} />;
  }

  return (
    <MainApp
      palette={palette}
      isDark={isDark}
      stealth={stealth}
      setIsDark={setIsDark}
      setStealth={setStealth}
      onSignedOut={() => setSignedIn(false)}
    />
  );
}

function Shell({ children, palette }: { children: React.ReactNode; palette: Palette }) {
  return (
    <SafeAreaView style={[styles.shell, { backgroundColor: palette.bg }]}>
      <StatusBar barStyle={palette.bg === "#0b0f14" ? "light-content" : "dark-content"} backgroundColor={palette.bg} />
      {children}
    </SafeAreaView>
  );
}

function SignInScreen({
  palette,
  isDark,
  setIsDark,
  onSignedIn,
}: {
  palette: Palette;
  isDark: boolean;
  setIsDark: (value: boolean) => void;
  onSignedIn: () => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [manual, setManual] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      if (manual) {
        if (!token.trim()) {
          throw new Error("Paste a Clerk session token.");
        }
        await signInWithSessionToken(token);
      } else {
        if (!identifier.trim() || !password) {
          throw new Error("Enter email/username and password.");
        }
        await signInWithPassword(identifier.trim(), password);
      }
      onSignedIn();
    } catch (error) {
      Alert.alert("Sign in failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell palette={palette}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
          <View style={styles.authHeader}>
            <View style={[styles.logo, { backgroundColor: palette.primary }]}>
              <Text style={styles.logoText}>EL</Text>
            </View>
            <Text style={[styles.title, { color: palette.text }]}>Expenser Lite</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>Dashboard, transactions, and bank SMS import.</Text>
          </View>

          <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Segmented
              palette={palette}
              options={[
                { label: "Password", active: !manual, onPress: () => setManual(false) },
                { label: "Token", active: manual, onPress: () => setManual(true) },
              ]}
            />
            {manual ? (
              <TextInput
                value={token}
                onChangeText={setToken}
                placeholder="Clerk session JWT"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
                multiline
                style={[styles.input, styles.tokenInput, inputColors(palette)]}
              />
            ) : (
              <>
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="Email or username"
                  placeholderTextColor={palette.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, inputColors(palette)]}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={palette.muted}
                  secureTextEntry
                  style={[styles.input, inputColors(palette)]}
                />
              </>
            )}
            <PrimaryButton palette={palette} label={loading ? "Signing in..." : "Sign in"} onPress={submit} disabled={loading} />
            <Pressable style={styles.inlineAction} onPress={() => setIsDark(!isDark)}>
              <Text style={[styles.linkText, { color: palette.primary }]}>{isDark ? "Use light mode" : "Use dark mode"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Shell>
  );
}

function MainApp({
  palette,
  isDark,
  stealth,
  setIsDark,
  setStealth,
  onSignedOut,
}: {
  palette: Palette;
  isDark: boolean;
  stealth: boolean;
  setIsDark: (value: boolean) => void;
  setStealth: (value: boolean) => void;
  onSignedOut: () => void;
}) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [formTransaction, setFormTransaction] = useState<Transaction | null | undefined>(undefined);

  const refreshNativeStatus = useCallback(async () => {
    try {
      const [enabled, queued] = await Promise.all([isNotificationAccessEnabled(), getQueuedImports()]);
      setNotificationEnabled(enabled);
      setQueuedCount(queued.length);
    } catch {
      setNotificationEnabled(false);
      setQueuedCount(0);
    }
  }, []);

  const syncBankImports = useCallback(async () => {
    try {
      const queued = await getQueuedImports();
      const imported: string[] = [];
      for (const item of queued) {
        await api.createTransaction(toTransactionPayload(item));
        imported.push(item.importSourceKey);
      }
      if (imported.length > 0) {
        await clearQueuedImports(imported);
        const [nextProfile, nextTransactions] = await Promise.all([api.getProfile(), api.getTransactions()]);
        setProfile(nextProfile);
        setTransactions(sortTransactions(nextTransactions));
      }
      setQueuedCount(Math.max(queued.length - imported.length, 0));
      return imported.length;
    } catch (error) {
      Alert.alert("SMS import failed", error instanceof Error ? error.message : "Queued imports remain saved.");
      return 0;
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [nextProfile, nextTransactions, nextCategories] = await Promise.all([
        api.getProfile(),
        api.getTransactions(),
        api.getCategories().catch(() => []),
      ]);
      setProfile(nextProfile);
      setTransactions(sortTransactions(nextTransactions));
      setCategories(nextCategories);
      await refreshNativeStatus();
      await syncBankImports();
      await promptBalanceAlerts(setProfile);
    } catch (error) {
      Alert.alert("Refresh failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, [refreshNativeStatus, syncBankImports]);

  useEffect(() => {
    refresh();
    const netSub = NetInfo.addEventListener(state => setOnline(Boolean(state.isConnected)));
    const appSub = AppState.addEventListener("change", nextState => {
      if (nextState === "active") {
        refreshNativeStatus();
        syncBankImports();
      }
    });
    return () => {
      netSub();
      appSub.remove();
    };
  }, [refresh, refreshNativeStatus, syncBankImports]);

  async function handleSave(payload: TransactionPayload) {
    try {
      if (formTransaction?._id) {
        const updated = await api.updateTransaction(formTransaction._id, payload);
        setTransactions(current => sortTransactions(current.map(item => (item._id === updated._id ? updated : item))));
      } else {
        const created = await api.createTransaction(payload);
        setTransactions(current => sortTransactions([created, ...current]));
      }
      setProfile(await api.getProfile());
      setFormTransaction(undefined);
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function handleDelete(transaction: Transaction) {
    Alert.alert(
      "Delete transaction?",
      getTransactionDisplayFields(transaction).description || "This transaction",
      [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteTransaction(transaction._id);
            setTransactions(current => current.filter(item => item._id !== transaction._id));
            setProfile(await api.getProfile());
          } catch (error) {
            Alert.alert("Delete failed", error instanceof Error ? error.message : "Please try again.");
          }
        },
      },
    ]);
  }

  async function handleSignOut() {
    await signOut();
    onSignedOut();
  }

  return (
    <Shell palette={palette}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.appName, { color: palette.text }]}>Expenser Lite</Text>
          <Text style={[styles.statusLine, { color: online ? palette.success : palette.danger }]}>
            {online ? "Online" : "Offline"} {notificationEnabled ? " • SMS ready" : ""}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <MiniButton palette={palette} label={stealth ? "Show" : "Hide"} onPress={() => setStealth(!stealth)} />
          <MiniButton palette={palette} label={isDark ? "Light" : "Dark"} onPress={() => setIsDark(!isDark)} />
        </View>
      </View>

      <View style={[styles.tabs, { borderColor: palette.border }]}>
        {(["dashboard", "transactions", "setup"] as Tab[]).map(item => (
          <Pressable
            key={item}
            onPress={() => setTab(item)}
            style={[styles.tab, tab === item && { backgroundColor: palette.surfaceAlt }]}
          >
            <Text style={[styles.tabText, { color: tab === item ? palette.primary : palette.muted }]}>
              {item[0].toUpperCase() + item.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.primary} />}
      >
        {tab === "dashboard" && (
          <Dashboard palette={palette} profile={profile} transactions={transactions} stealth={stealth} onAdd={() => setFormTransaction(null)} />
        )}
        {tab === "transactions" && (
          <Transactions
            palette={palette}
            transactions={transactions}
            stealth={stealth}
            onAdd={() => setFormTransaction(null)}
            onEdit={setFormTransaction}
            onDelete={handleDelete}
            onRefresh={refresh}
          />
        )}
        {tab === "setup" && (
          <Setup
            palette={palette}
            categories={categories}
            notificationEnabled={notificationEnabled}
            queuedCount={queuedCount}
            onOpenSettings={async () => {
              await openNotificationAccessSettings();
              setTimeout(refreshNativeStatus, 800);
            }}
            onImport={syncBankImports}
            onAddCategory={async (name, type) => {
              const created = await api.saveCategory({
                name,
                type,
                color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
              });
              setCategories(current => [...current, created]);
            }}
            onSignOut={handleSignOut}
          />
        )}
      </ScrollView>

      <TransactionModal
        palette={palette}
        visible={formTransaction !== undefined}
        transaction={formTransaction || null}
        categories={categories}
        onCancel={() => setFormTransaction(undefined)}
        onSave={handleSave}
      />
    </Shell>
  );
}

async function promptBalanceAlerts(setProfile: (profile: UserProfile | null) => void) {
  const alerts = await api.getBalanceAlerts().catch(() => []);
  const pending = alerts.find(alert => alert.status === "pending");
  if (!pending) {
    return;
  }
  Alert.alert(
    "Bank balance mismatch",
    `Bank (UPI) says ${money(pending.bankBalance)} but the app expected ${money(pending.expectedBalance)}.`,
    [
      { text: "Keep app value", onPress: () => api.resolveBalanceAlert(pending._id, "keep").catch(() => {}) },
      {
        text: "Use bank value",
        onPress: async () => {
          const result = await api.resolveBalanceAlert(pending._id, "apply");
          if (result.profile) {
            setProfile(result.profile);
          }
        },
      },
    ]
  );
}

function Dashboard({
  palette,
  profile,
  transactions,
  stealth,
  onAdd,
}: {
  palette: Palette;
  profile: UserProfile | null;
  transactions: Transaction[];
  stealth: boolean;
  onAdd: () => void;
}) {
  const recent = transactions.slice(0, 5);
  const balance = profile?.balances || { bank: 0, cash: 0, splitwise: 0 };
  const total = balance.bank + balance.cash + balance.splitwise;

  return (
    <View>
      <View style={[styles.balancePanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.label, { color: palette.muted }]}>Total balance</Text>
        <Text style={[styles.balanceText, { color: palette.text }]}>Rs {money(total, stealth)}</Text>
        <View style={styles.balanceGrid}>
          <BalanceTile palette={palette} label="Bank (UPI)" value={balance.bank} stealth={stealth} />
          <BalanceTile palette={palette} label="Cash" value={balance.cash} stealth={stealth} />
          <BalanceTile palette={palette} label="Splitwise" value={balance.splitwise} stealth={stealth} />
        </View>
      </View>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent</Text>
        <MiniButton palette={palette} label="Add" onPress={onAdd} />
      </View>
      {recent.map(item => (
        <TransactionRow key={item._id} palette={palette} transaction={item} stealth={stealth} />
      ))}
      {recent.length === 0 && <EmptyState palette={palette} text="No transactions yet." />}
    </View>
  );
}

function Transactions({
  palette,
  transactions,
  stealth,
  onAdd,
  onEdit,
  onDelete,
  onRefresh,
}: {
  palette: Palette;
  transactions: Transaction[];
  stealth: boolean;
  onAdd: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onRefresh: () => Promise<void>;
}) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Transactions</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <MiniButton palette={palette} label="Refresh" onPress={() => void onRefresh()} />
          <MiniButton palette={palette} label="Add" onPress={onAdd} />
        </View>
      </View>
      {transactions.map(item => (
        <Pressable
          key={item._id}
          style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}
          onPress={() => onEdit(item)}
          onLongPress={() => onDelete(item)}
        >
          <TransactionRowContent palette={palette} transaction={item} stealth={stealth} />
          <Text style={[styles.rowHint, { color: palette.muted }]}>Tap edit • Long press delete</Text>
        </Pressable>
      ))}
      {transactions.length === 0 && <EmptyState palette={palette} text="No transactions found." />}
    </View>
  );
}

function Setup({
  palette,
  categories,
  notificationEnabled,
  queuedCount,
  onOpenSettings,
  onImport,
  onAddCategory,
  onSignOut,
}: {
  palette: Palette;
  categories: UserCategory[];
  notificationEnabled: boolean;
  queuedCount: number;
  onOpenSettings: () => void;
  onImport: () => Promise<number>;
  onAddCategory: (name: string, type: TransactionType) => Promise<void>;
  onSignOut: () => void;
}) {
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<TransactionType>("expense");
  const [saving, setSaving] = useState(false);

  async function saveCategory() {
    if (!categoryName.trim()) {
      Alert.alert("Category required", "Enter a category name.");
      return;
    }
    setSaving(true);
    try {
      await onAddCategory(categoryName.trim(), categoryType);
      setCategoryName("");
    } catch (error) {
      Alert.alert("Category failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Bank SMS import</Text>
        <Text style={[styles.bodyText, { color: palette.muted }]}>
          Notification access: {notificationEnabled ? "enabled" : "not enabled"}
        </Text>
        <Text style={[styles.bodyText, { color: palette.muted }]}>Queued imports: {queuedCount}</Text>
        <View style={styles.buttonRow}>
          <PrimaryButton palette={palette} label="Open settings" onPress={onOpenSettings} />
          <PrimaryButton
            palette={palette}
            label="Import now"
            onPress={async () => {
              const count = await onImport();
              Alert.alert("Import complete", `${count} transaction${count === 1 ? "" : "s"} imported.`);
            }}
          />
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Categories</Text>
        <Segmented
          palette={palette}
          options={[
            { label: "Expense", active: categoryType === "expense", onPress: () => setCategoryType("expense") },
            { label: "Income", active: categoryType === "income", onPress: () => setCategoryType("income") },
          ]}
        />
        <TextInput
          value={categoryName}
          onChangeText={setCategoryName}
          placeholder="New category"
          placeholderTextColor={palette.muted}
          style={[styles.input, inputColors(palette)]}
        />
        <PrimaryButton palette={palette} label={saving ? "Saving..." : "Add category"} onPress={saveCategory} disabled={saving} />
        <View style={styles.chipWrap}>
          {categories.map(category => (
            <View key={category._id} style={[styles.chip, { borderColor: palette.border, backgroundColor: palette.surfaceAlt }]}>
              <Text style={{ color: palette.text }}>{category.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <PrimaryButton palette={palette} label="Sign out" onPress={onSignOut} danger />
    </View>
  );
}

function TransactionModal({
  palette,
  visible,
  transaction,
  categories,
  onCancel,
  onSave,
}: {
  palette: Palette;
  visible: boolean;
  transaction: Transaction | null;
  categories: UserCategory[];
  onCancel: () => void;
  onSave: (payload: TransactionPayload) => Promise<void>;
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(
        transaction
          ? {
              type: transaction.type,
              amount: String(transaction.amount),
              description: transaction.description,
              category: transaction.category,
              paymentMethod: transaction.paymentMethod,
              date: (transaction.date || new Date().toISOString()).slice(0, 10),
            }
          : emptyForm
      );
    }
  }, [transaction, visible]);

  async function submit() {
    const amount = Number(form.amount);
    const allowsPendingReview = Boolean(
      transaction?.importSource || transaction?.reviewStatus === "pending"
    );
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid amount.");
      return;
    }
    if (!allowsPendingReview && !form.description.trim()) {
      Alert.alert("Description required", "Enter a description.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        amount,
        description: allowsPendingReview
          ? form.description.trim()
          : form.description.trim(),
        category: allowsPendingReview
          ? form.category.trim()
          : form.category.trim() || "other",
        paymentMethod: form.paymentMethod,
        date: new Date(form.date).toISOString(),
      };
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  }

  const filteredCategories = categories.filter(category => category.type === form.type);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <Shell palette={palette}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.titleSmall, { color: palette.text }]}>{transaction ? "Edit transaction" : "Add transaction"}</Text>
            <Segmented
              palette={palette}
              options={[
                { label: "Expense", active: form.type === "expense", onPress: () => setForm({ ...form, type: "expense" }) },
                { label: "Income", active: form.type === "income", onPress: () => setForm({ ...form, type: "income" }) },
              ]}
            />
            <TextInput
              value={form.amount}
              onChangeText={amount => setForm({ ...form, amount })}
              keyboardType="decimal-pad"
              placeholder="Amount"
              placeholderTextColor={palette.muted}
              style={[styles.input, inputColors(palette)]}
            />
            <TextInput
              value={form.description}
              onChangeText={description => setForm({ ...form, description })}
              placeholder="Description"
              placeholderTextColor={palette.muted}
              style={[styles.input, inputColors(palette)]}
            />
            <TextInput
              value={form.category}
              onChangeText={category => setForm({ ...form, category })}
              placeholder="Category"
              placeholderTextColor={palette.muted}
              style={[styles.input, inputColors(palette)]}
            />
            <View style={styles.chipWrap}>
              {filteredCategories.map(category => (
                <Pressable
                  key={category._id}
                  style={[styles.chip, { borderColor: palette.border, backgroundColor: palette.surfaceAlt }]}
                  onPress={() => setForm({ ...form, category: category.name })}
                >
                  <Text style={{ color: palette.text }}>{category.name}</Text>
                </Pressable>
              ))}
            </View>
            <Segmented
              palette={palette}
              options={[
                { label: "Bank (UPI)", active: form.paymentMethod === "bank", onPress: () => setForm({ ...form, paymentMethod: "bank" }) },
                { label: "Cash", active: form.paymentMethod === "cash", onPress: () => setForm({ ...form, paymentMethod: "cash" }) },
                {
                  label: "Splitwise",
                  active: form.paymentMethod === "splitwise",
                  onPress: () => setForm({ ...form, paymentMethod: "splitwise" }),
                },
              ]}
            />
            <TextInput
              value={form.date}
              onChangeText={date => setForm({ ...form, date })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.muted}
              style={[styles.input, inputColors(palette)]}
            />
            <View style={styles.buttonRow}>
              <PrimaryButton palette={palette} label="Cancel" onPress={onCancel} secondary />
              <PrimaryButton palette={palette} label={saving ? "Saving..." : "Save"} onPress={submit} disabled={saving} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Shell>
    </Modal>
  );
}

function BalanceTile({ palette, label, value, stealth }: { palette: Palette; label: string; value: number; stealth: boolean }) {
  return (
    <View style={[styles.balanceTile, { backgroundColor: palette.surfaceAlt }]}>
      <Text style={[styles.tileLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: palette.text }]}>Rs {money(value, stealth)}</Text>
    </View>
  );
}

function TransactionRow({ palette, transaction, stealth }: { palette: Palette; transaction: Transaction; stealth: boolean }) {
  return (
    <View style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <TransactionRowContent palette={palette} transaction={transaction} stealth={stealth} />
    </View>
  );
}

function TransactionRowContent({ palette, transaction, stealth }: { palette: Palette; transaction: Transaction; stealth: boolean }) {
  const amountColor = transaction.type === "income" ? palette.success : palette.danger;
  const display = getTransactionDisplayFields(transaction);
  return (
    <View style={styles.rowContent}>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
          {display.description}
        </Text>
        <Text style={[styles.rowMeta, { color: palette.muted }]} numberOfLines={1}>
          {display.category} • {paymentLabel(transaction.paymentMethod)}
        </Text>
        {transaction.reviewStatus === "pending" && (
          <Text style={[styles.rowMeta, { color: palette.primary }]}>Pending review</Text>
        )}
      </View>
      <Text style={[styles.rowAmount, { color: amountColor }]}>
        {transaction.type === "income" ? "+" : "-"} Rs {money(transaction.amount, stealth)}
      </Text>
    </View>
  );
}

function EmptyState({ palette, text }: { palette: Palette; text: string }) {
  return (
    <View style={[styles.empty, { borderColor: palette.border }]}>
      <Text style={{ color: palette.muted }}>{text}</Text>
    </View>
  );
}

function PrimaryButton({
  palette,
  label,
  onPress,
  disabled,
  secondary,
  danger,
}: {
  palette: Palette;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  const backgroundColor = secondary ? palette.surfaceAlt : danger ? palette.danger : palette.primary;
  const color = secondary ? palette.text : "#ffffff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, { backgroundColor, opacity: disabled ? 0.6 : 1 }]}
    >
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function MiniButton({ palette, label, onPress }: { palette: Palette; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.miniButton, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
      <Text style={[styles.miniButtonText, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

function Segmented({
  palette,
  options,
}: {
  palette: Palette;
  options: Array<{ label: string; active: boolean; onPress: () => void }>;
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: palette.surfaceAlt }]}>
      {options.map(option => (
        <Pressable
          key={option.label}
          onPress={option.onPress}
          style={[styles.segment, option.active && { backgroundColor: palette.primary }]}
        >
          <Text style={[styles.segmentText, { color: option.active ? "#ffffff" : palette.text }]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function inputColors(palette: Palette) {
  return {
    backgroundColor: palette.input,
    borderColor: palette.border,
    color: palette.text,
  };
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  authContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
  authHeader: { alignItems: "center", marginBottom: 28 },
  logo: { width: 64, height: 64, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  logoText: { color: "#ffffff", fontSize: 22, fontWeight: "800" },
  title: { fontSize: 30, fontWeight: "800" },
  titleSmall: { fontSize: 24, fontWeight: "800", marginBottom: 16 },
  subtitle: { fontSize: 14, marginTop: 6, textAlign: "center" },
  panel: { borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, minHeight: 46, marginTop: 12, fontSize: 15 },
  tokenInput: { minHeight: 120, textAlignVertical: "top", paddingTop: 12 },
  button: { borderRadius: 8, minHeight: 46, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", marginTop: 12 },
  buttonText: { fontSize: 15, fontWeight: "700" },
  inlineAction: { alignItems: "center", paddingTop: 12 },
  linkText: { fontSize: 14, fontWeight: "700" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  appName: { fontSize: 22, fontWeight: "800" },
  statusLine: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  miniButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, minHeight: 34, justifyContent: "center" },
  miniButtonText: { fontSize: 12, fontWeight: "700" },
  tabs: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, padding: 6, gap: 6 },
  tab: { flex: 1, minHeight: 38, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tabText: { fontSize: 13, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 32 },
  balancePanel: { borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 18 },
  label: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  balanceText: { fontSize: 34, fontWeight: "900", marginTop: 6 },
  balanceGrid: { gap: 10, marginTop: 14 },
  balanceTile: { borderRadius: 8, padding: 12 },
  tileLabel: { fontSize: 12, marginBottom: 4 },
  tileValue: { fontSize: 17, fontWeight: "800" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  bodyText: { fontSize: 14, lineHeight: 22, marginTop: 8 },
  row: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  rowContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "800" },
  rowMeta: { fontSize: 12, marginTop: 4 },
  rowAmount: { fontSize: 14, fontWeight: "900", flexShrink: 0 },
  rowHint: { fontSize: 11, marginTop: 8 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 8, padding: 18, alignItems: "center" },
  segmented: { flexDirection: "row", borderRadius: 8, padding: 4, gap: 4, marginBottom: 4 },
  segment: { flex: 1, borderRadius: 6, minHeight: 36, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  segmentText: { fontSize: 13, fontWeight: "800" },
  buttonRow: { flexDirection: "row", gap: 10 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, minHeight: 32, justifyContent: "center" },
});
