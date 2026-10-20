import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../context/ThemeContext";
import { useStealthMode } from "../../context/StealthContext";
import { useUserContext } from "../../context/UserContext";
import { useToast } from "../../context/ToastContext";
import {
  Colors,
  paymentMethodConfig,
} from "../../constants/theme";
import { api } from "../../lib/api";
import { formatCurrency, formatDate } from "../../lib/utils";
import { ITransaction, IUserCategory, PaymentMethod, TransactionType, UpdateTransactionPayload } from "../../lib/types";
import ConfirmModal from "../../components/ConfirmModal";
import ResponsiveModal from "../../components/ResponsiveModal";
import {
  getPendingReviewUpdate,
  getTransactionDisplayFields,
} from "../../lib/transaction-review";

const PAGE_SIZE = 10;
const IMPORTED_FALLBACK_CATEGORY = "bank import";

const paymentMethods: { id: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "bank", label: "Bank (UPI)", icon: "card" },
  { id: "cash", label: "Cash", icon: "cash" },
  { id: "splitwise", label: "Splitwise", icon: "swap-horizontal" },
];

const EXPENSE_CATEGORIES = [
  { id: "food", label: "Food", icon: "restaurant-outline" as const, color: "#f97316" },
  { id: "transport", label: "Transport", icon: "car-outline" as const, color: "#3b82f6" },
  { id: "shopping", label: "Shopping", icon: "bag-handle-outline" as const, color: "#ec4899" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal-circle-outline" as const, color: "#6b7280" },
];

const INCOME_CATEGORIES = [
  { id: "salary", label: "Salary", icon: "briefcase-outline" as const, color: "#10b981" },
  { id: "gift", label: "Gift", icon: "gift-outline" as const, color: "#a855f7" },
  { id: "exchange", label: "Exchange", icon: "swap-horizontal-outline" as const, color: "#0ea5e9" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal-circle-outline" as const, color: "#6b7280" },
];

type EditMode = "edit" | "review";
type ActiveTransactionModal = "none" | "edit" | "delete";

type CategoryOption = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const TransactionListRow = React.memo(function TransactionListRow({
  transaction,
  colors,
  stealth,
  onPress,
}: {
  transaction: ITransaction;
  colors: typeof Colors.light;
  stealth: boolean;
  onPress: (transaction: ITransaction) => void;
}) {
  const display = getTransactionDisplayFields(transaction);
  return (
    <TouchableOpacity
      onPress={() => onPress(transaction)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${display.description}, ${transaction.type}, ${formatCurrency(transaction.amount)}`}
      style={{
        alignItems: "center",
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
        padding: 14,
      }}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            backgroundColor:
              transaction.type === "income" ? colors.successBg : colors.errorBg,
            borderRadius: 10,
            padding: 10,
          }}
        >
          <Ionicons
            name={transaction.type === "income" ? "trending-up" : "trending-down"}
            size={20}
            color={transaction.type === "income" ? colors.success : colors.error}
          />
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text
            style={{ fontWeight: "600", color: colors.text, fontSize: 15 }}
            numberOfLines={1}
          >
            {display.description}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            {paymentMethodConfig[transaction.paymentMethod]?.label} · {formatDate(transaction.date)}
          </Text>
          {transaction.reviewStatus === "needs_category" && (
            <Text style={{ fontSize: 11, color: colors.warning, marginTop: 2, fontWeight: "600" }}>
              Choose category
            </Text>
          )}
          {transaction.exchangeExpenseId && (
            <Text style={{ fontSize: 11, color: colors.info, marginTop: 2 }}>
              Offsets linked expense
            </Text>
          )}
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={{
            fontWeight: "700",
            fontSize: 16,
            color: transaction.type === "income" ? colors.success : colors.error,
          }}
        >
          {transaction.type === "income" ? "+" : "-"}₹
          {stealth ? "••••••" : formatCurrency(transaction.amount)}
        </Text>
        {(transaction.splitAmount ?? 0) > 0 && (
          <Text style={{ fontSize: 11, color: colors.splitwise, marginTop: 2 }}>
            Split: ₹{stealth ? "••••••" : formatCurrency(transaction.splitAmount ?? 0)}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
});

function normalizeEditableCategory(category: string) {
  const trimmed = category.trim();
  if (!trimmed || trimmed.toLowerCase() === IMPORTED_FALLBACK_CATEGORY) {
    return "";
  }

  return trimmed;
}

function getCategoriesForType(
  type: TransactionType,
  userCategories: IUserCategory[],
  selectedCategory: string
): CategoryOption[] {
  const builtIns = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const builtInIds = new Set(builtIns.map((category) => category.id.toLowerCase()));
  const customCategories = userCategories
    .filter((category) => category.type === type && !builtInIds.has(category.name.toLowerCase()))
    .map((category) => ({
      id: category.name,
      label: category.name,
      icon: "pricetag-outline" as const,
      color: category.color,
    }));
  const options = [...builtIns, ...customCategories];

  if (
    selectedCategory.trim() &&
    !options.some((category) => category.id.toLowerCase() === selectedCategory.toLowerCase())
  ) {
    options.push({
      id: selectedCategory,
      label: selectedCategory,
      icon: "pricetag-outline",
      color: "#6b7280",
    });
  }

  return options;
}

export default function TransactionsScreen() {
  const { isDark } = useTheme();
  const { isStealthMode, toggleStealthMode } = useStealthMode();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const params = useLocalSearchParams<{ reviewId?: string }>();
  const insets = useSafeAreaInsets();
  const {
    profile,
    transactions,
    loading,
    deleteTransaction,
    updateTransaction,
    isOnline,
    refreshTransactions,
  } = useUserContext();
  const { showToast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const [activeModal, setActiveModal] = useState<ActiveTransactionModal>("none");
  const [transactionToDelete, setTransactionToDelete] = useState<ITransaction | null>(null);
  const [editingTxn, setEditingTxn] = useState<ITransaction | null>(null);
  const [editMode, setEditMode] = useState<EditMode>("edit");
  const [editType, setEditType] = useState<TransactionType>("expense");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>("bank");
  const [editSplitAmount, setEditSplitAmount] = useState("");
  const [editIsSplit, setEditIsSplit] = useState(false);
  const [userCategories, setUserCategories] = useState<IUserCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const handledReviewIdRef = useRef<string | null>(null);
  const reviewId = typeof params.reviewId === "string" ? params.reviewId : undefined;

  const categoryOptions = useMemo(
    () =>
      getCategoriesForType(editType, userCategories, editCategory).filter(
        (category) => editMode !== "review" || category.id !== "exchange"
      ),
    [editCategory, editMode, editType, userCategories]
  );

  useEffect(() => {
    let active = true;

    api.getCategories()
      .then((categories) => {
        if (active) {
          setUserCategories(categories);
        }
      })
      .catch((error) => {
        console.error("[Transactions] Failed to load categories:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTransactions();
    } finally {
      setRefreshing(false);
    }
  }, [refreshTransactions]);

  const paginatedTransactions = useMemo(
    () => transactions.slice(0, page * PAGE_SIZE),
    [page, transactions]
  );
  const hasMore = transactions.length > page * PAGE_SIZE;

  const handleDeletePress = (txn: ITransaction) => {
    setTransactionToDelete(txn);
    setActiveModal("delete");
  };

  const handleConfirmDelete = async () => {
    if (!transactionToDelete) return;
    setDeleting(transactionToDelete._id);
    try {
      await deleteTransaction(transactionToDelete._id);
    } catch {
      // Error handled
    } finally {
      setDeleting(null);
      setActiveModal("none");
      setTransactionToDelete(null);
    }
  };

  const closeEditModal = () => {
    if (saving) return;
    setActiveModal("none");
    setEditingTxn(null);
    setEditMode("edit");
    setEditCategory("");
  };

  const handleEditPress = useCallback((txn: ITransaction, mode?: EditMode) => {
    setEditingTxn(txn);
    setEditMode(mode ?? (txn.reviewStatus === "needs_category" ? "review" : "edit"));
    setEditType(txn.type);
    setEditAmount(txn.amount.toString());
    setEditDescription(txn.description);
    setEditCategory(normalizeEditableCategory(txn.category));
    setEditPaymentMethod(txn.paymentMethod);
    setEditSplitAmount((txn.splitAmount || 0).toString());
    setEditIsSplit((txn.splitAmount || 0) > 0);
    setActiveModal("edit");
  }, []);

  useEffect(() => {
    if (!reviewId) {
      handledReviewIdRef.current = null;
      return;
    }

    if (loading || handledReviewIdRef.current === reviewId) {
      return;
    }

    const targetTransaction = transactions.find((transaction) => transaction._id === reviewId);
    handledReviewIdRef.current = reviewId;

    if (!targetTransaction) {
      router.setParams({ reviewId: undefined });
      return;
    }

    handleEditPress(targetTransaction, "review");
    router.setParams({ reviewId: undefined });
  }, [handleEditPress, loading, reviewId, router, showToast, transactions]);

  const handleSaveEdit = async () => {
    if (!editingTxn) return;
    const trimmedDescription = editDescription.trim();
    const trimmedCategory = editCategory.trim();

    if (!trimmedCategory) {
      showToast("Please choose a category", "error");
      return;
    }

    let payload: UpdateTransactionPayload;
    if (editMode === "review") {
      payload = getPendingReviewUpdate({
        description: trimmedDescription,
        category: trimmedCategory,
      });
    } else {
      const parsedAmount = parseFloat(editAmount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        showToast("Please enter a valid amount", "error");
        return;
      }

      if (editIsSplit && Number(editSplitAmount || "0") >= parsedAmount) {
        showToast("Split amount must be less than total amount", "error");
        return;
      }

      payload = {
        type: editType,
        amount: parsedAmount,
        description: trimmedDescription,
        category: trimmedCategory,
        paymentMethod: editPaymentMethod,
        splitAmount: editIsSplit ? parseFloat(editSplitAmount || "0") : 0,
      };
    }

    setSaving(true);
    try {
      await updateTransaction(editingTxn._id, payload);
      setActiveModal("none");
      setEditingTxn(null);
      setEditMode("edit");
      setEditCategory("");
    } catch (error: any) {
      console.error("Failed to update:", error);
      showToast(error?.message || "Failed to update transaction", "error");
    } finally {
      setSaving(false);
    }
  };

  const availableMethods = paymentMethods.filter(
    (method) =>
      profile?.paymentMethods?.includes(method.id) || method.id === editPaymentMethod
  );
  const needsCategoryCount = transactions.filter(
    (transaction) => transaction.reviewStatus === "needs_category"
  ).length;
  const saveDisabled =
    saving ||
    (editMode !== "review" && !editAmount) ||
    !editCategory.trim();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Top Bar */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <View>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>
            Transactions
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 2 }}>
            {transactions.length} total transactions
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
            <Ionicons name="refresh-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleStealthMode}
            style={{ padding: 4 }}
          >
            <Ionicons
              name={isStealthMode ? "eye-off" : "eye"}
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
            }}
            onPress={() => router.push("/add-transaction")}
          >
            <Ionicons name="add" size={18} color={colors.primaryForeground} />
            <Text
              style={{
                color: colors.primaryForeground,
                fontWeight: "600",
                marginLeft: 4,
              }}
            >
              Add
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={paginatedTransactions}
        keyExtractor={(transaction) => transaction._id}
        renderItem={({ item }) => (
          <TransactionListRow
            transaction={item}
            colors={colors}
            stealth={isStealthMode}
            onPress={handleEditPress}
          />
        )}
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: transactions.length === 0 ? 1 : undefined,
          padding: 16,
          paddingTop: 0,
        }}
        initialNumToRender={PAGE_SIZE}
        maxToRenderPerBatch={PAGE_SIZE}
        windowSize={7}
        removeClippedSubviews
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (hasMore) setPage((current) => current + 1);
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
          {!isOnline && (
          <View
            style={{
              alignItems: "center",
              backgroundColor: colors.warningBg,
              borderRadius: 12,
              flexDirection: "row",
              marginBottom: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
            <Text style={{ color: colors.warning, fontSize: 12, marginLeft: 8, flex: 1 }}>
              Offline — changes stay on this phone and upload automatically.
            </Text>
          </View>
        )}

        {needsCategoryCount > 0 && (
          <TouchableOpacity
            onPress={() => {
              const next = transactions.find((item) => item.reviewStatus === "needs_category");
              if (next) handleEditPress(next, "review");
            }}
            accessibilityRole="button"
            accessibilityLabel={`Review ${needsCategoryCount} bank ${needsCategoryCount === 1 ? "import" : "imports"} needing a category`}
            style={{
              alignItems: "center",
              backgroundColor: colors.warningBg,
              borderColor: colors.warning + "44",
              borderRadius: 12,
              borderWidth: 1,
              flexDirection: "row",
              marginBottom: 12,
              padding: 12,
            }}
          >
            <Ionicons name="pricetag-outline" size={18} color={colors.warning} />
            <Text style={{ color: colors.text, flex: 1, fontWeight: "600", marginLeft: 9 }}>
              {needsCategoryCount} bank {needsCategoryCount === 1 ? "import needs" : "imports need"} a category
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.warning} />
          </TouchableOpacity>
        )}
          </>
        }
        ListEmptyComponent={
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 32,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
            <Text
              style={{
                color: colors.textMuted,
                marginTop: 16,
                fontSize: 16,
              }}
            >
              No transactions yet
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 10,
                marginTop: 16,
              }}
              onPress={() => router.push("/add-transaction")}
            >
              <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>
                Add your first transaction
              </Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={hasMore ? (
          <TouchableOpacity
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              marginTop: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => setPage((p) => p + 1)}
          >
            <Text style={{ color: colors.primary, fontWeight: "600" }}>
              Load More ({transactions.length - page * PAGE_SIZE} remaining)
            </Text>
          </TouchableOpacity>
        ) : <View style={{ height: 24 }} />}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={activeModal === "delete"}
        onClose={() => {
          setActiveModal("none");
          setTransactionToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Transaction"
        message={`Are you sure you want to delete "${
          transactionToDelete
            ? getTransactionDisplayFields(transactionToDelete).description
            : "this transaction"
        }"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="destructive"
        icon="trash-outline"
        loading={deleting !== null}
      />

      {/* Edit Transaction Modal */}
      <ResponsiveModal
        visible={activeModal === "edit"}
        onClose={closeEditModal}
        loading={saving}
        contentStyle={{ padding: 20 }}
      >
                  {/* Header */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
                        {editMode === "review" ? "Choose a Category" : "Edit Transaction"}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                        {editMode === "review"
                          ? "Categorize this bank import. The description is optional."
                          : "Update the transaction details."}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={closeEditModal}>
                      <Ionicons name="close" size={24} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 4 }}
                  >
                    {editMode === "review" && (
                      <View
                        style={{
                          backgroundColor: colors.warningBg,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.warning + "33",
                          padding: 12,
                          marginBottom: 16,
                        }}
                      >
                        <Text style={{ color: colors.warning, fontWeight: "700", fontSize: 13 }}>
                          Category needed
                        </Text>
                        <Text style={{ color: colors.text, fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                          Choose a category to make this transaction active.
                        </Text>
                      </View>
                    )}

                    {editMode !== "review" && (
                      <>
                        {/* Type Selector */}
                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          padding: 12,
                          borderRadius: 10,
                          backgroundColor: editType === "expense" ? colors.errorBg : colors.card,
                          borderWidth: 2,
                          borderColor: editType === "expense" ? colors.error : colors.border,
                          alignItems: "center",
                        }}
                        onPress={() => setEditType("expense")}
                      >
                        <Ionicons name="arrow-down" size={20} color={editType === "expense" ? colors.error : colors.textMuted} />
                        <Text style={{ marginTop: 4, fontWeight: "600", color: editType === "expense" ? colors.error : colors.textMuted, fontSize: 12 }}>
                          Expense
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          padding: 12,
                          borderRadius: 10,
                          backgroundColor: editType === "income" ? colors.successBg : colors.card,
                          borderWidth: 2,
                          borderColor: editType === "income" ? colors.success : colors.border,
                          alignItems: "center",
                        }}
                        onPress={() => {
                          setEditType("income");
                          setEditIsSplit(false);
                          setEditSplitAmount("");
                        }}
                      >
                        <Ionicons name="arrow-up" size={20} color={editType === "income" ? colors.success : colors.textMuted} />
                        <Text style={{ marginTop: 4, fontWeight: "600", color: editType === "income" ? colors.success : colors.textMuted, fontSize: 12 }}>
                          Income
                        </Text>
                      </TouchableOpacity>
                        </View>

                        {/* Amount */}
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 6 }}>Amount</Text>
                        <TextInput
                      style={{
                        backgroundColor: colors.backgroundSecondary,
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 16,
                        color: colors.text,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                      value={editAmount}
                      onChangeText={setEditAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                        />
                      </>
                    )}

                    {/* Description */}
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 6 }}>Description (optional)</Text>
                    <TextInput
                      style={{
                        backgroundColor: colors.backgroundSecondary,
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 16,
                        color: colors.text,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                      value={editDescription}
                      onChangeText={setEditDescription}
                      placeholder="What was this for?"
                      placeholderTextColor={colors.textMuted}
                    />

                    {/* Category */}
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 6 }}>
                      Category
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      {categoryOptions.map((category) => {
                        const isSelected = editCategory === category.id;

                        return (
                          <TouchableOpacity
                            key={category.id}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 8,
                              backgroundColor: isSelected ? `${category.color}18` : colors.card,
                              borderWidth: 1,
                              borderColor: isSelected ? category.color : colors.border,
                            }}
                            onPress={() => setEditCategory(category.id)}
                          >
                            <Ionicons
                              name={category.icon}
                              size={16}
                              color={category.color}
                            />
                            <Text style={{ marginLeft: 6, color: colors.text, fontSize: 13 }}>
                              {category.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {editMode !== "review" && (
                      <>
                        {/* Payment Method */}
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 6 }}>Payment Method</Text>
                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      {availableMethods.map((method) => {
                        const config = paymentMethodConfig[method.id];
                        const isSelected = editPaymentMethod === method.id;
                        return (
                          <TouchableOpacity
                            key={method.id}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 8,
                              backgroundColor: isSelected ? (isDark ? config.darkBg : config.lightBg) : colors.card,
                              borderWidth: 1,
                              borderColor: isSelected ? (isDark ? config.darkColor : config.lightColor) : colors.border,
                            }}
                            onPress={() => setEditPaymentMethod(method.id)}
                          >
                            <Ionicons
                              name={method.icon}
                              size={16}
                              color={isDark ? config.darkColor : config.lightColor}
                            />
                            <Text style={{ marginLeft: 6, color: colors.text, fontSize: 13 }}>
                              {method.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                        </View>

                        {/* Split Option (for expenses only) */}
                        {editType === "expense" && (
                          <View style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>Split transaction?</Text>
                          <Switch
                            value={editIsSplit}
                            onValueChange={setEditIsSplit}
                            trackColor={{ false: colors.border, true: colors.splitwise }}
                          />
                        </View>
                        {editIsSplit && (
                          <TextInput
                            style={{
                              backgroundColor: colors.backgroundSecondary,
                              borderRadius: 10,
                              padding: 12,
                              fontSize: 16,
                              color: colors.text,
                              borderWidth: 1,
                              borderColor: colors.splitwise + "40",
                            }}
                            value={editSplitAmount}
                            onChangeText={setEditSplitAmount}
                            keyboardType="numeric"
                            placeholder="Amount owed to you"
                            placeholderTextColor={colors.textMuted}
                          />
                        )}
                          </View>
                        )}
                      </>
                    )}

                    {/* Save Button */}
                    <TouchableOpacity
                      style={{
                        backgroundColor: colors.primary,
                        borderRadius: 12,
                        padding: 14,
                        alignItems: "center",
                        marginTop: 8,
                        opacity: saveDisabled ? 0.55 : 1,
                      }}
                      onPress={handleSaveEdit}
                      disabled={saveDisabled}
                    >
                      {saving ? (
                        <ActivityIndicator color={colors.primaryForeground} />
                      ) : (
                        <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "600" }}>
                          {editMode === "review" ? "Save Review" : "Save Changes"}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {editMode !== "review" && (
                      <TouchableOpacity
                        style={{ alignItems: "center", padding: 14, marginTop: 8 }}
                        onPress={() => {
                          if (!editingTxn) return;
                          const transaction = editingTxn;
                          setEditingTxn(null);
                          setEditMode("edit");
                          setEditCategory("");
                          handleDeletePress(transaction);
                        }}
                      >
                        <Text style={{ color: colors.error, fontSize: 15, fontWeight: "600" }}>
                          Delete transaction
                        </Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
      </ResponsiveModal>
    </View>
  );
}
