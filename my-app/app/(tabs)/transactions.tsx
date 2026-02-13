import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../context/ThemeContext";
import { useUserContext } from "../../context/UserContext";
import { Colors, paymentMethodConfig, CATEGORIES } from "../../constants/theme";
import { formatCurrency, formatDate } from "../../lib/utils";
import { ITransaction, PaymentMethod, TransactionType } from "../../lib/types";
import SyncStatusBanner from "../../components/SyncStatusBanner";
import ConfirmModal from "../../components/ConfirmModal";

const PAGE_SIZE = 10;

const paymentMethods: { id: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "bank", label: "Bank (UPI)", icon: "card" },
  { id: "cash", label: "Cash", icon: "cash" },
  { id: "splitwise", label: "Splitwise", icon: "swap-horizontal" },
];

export default function TransactionsScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    profile,
    transactions,
    loading,
    refreshTransactions,
    deleteTransaction,
    updateTransaction,
    isOnline,
    syncing,
    manualRefresh,
  } = useUserContext();

  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Delete confirmation modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<ITransaction | null>(null);
  
  // Edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTxn, setEditingTxn] = useState<ITransaction | null>(null);
  const [editType, setEditType] = useState<TransactionType>("expense");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>("bank");
  const [editSplitAmount, setEditSplitAmount] = useState("");
  const [editIsSplit, setEditIsSplit] = useState(false);
  const [saving, setSaving] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await manualRefresh();
    setRefreshing(false);
  };

  const paginatedTransactions = transactions.slice(0, page * PAGE_SIZE);
  const hasMore = transactions.length > page * PAGE_SIZE;

  const handleDeletePress = (txn: ITransaction) => {
    setTransactionToDelete(txn);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!transactionToDelete) return;
    setDeleting(transactionToDelete._id);
    try {
      await deleteTransaction(transactionToDelete._id);
    } catch (error) {
      // Error handled
    } finally {
      setDeleting(null);
      setDeleteModalVisible(false);
      setTransactionToDelete(null);
    }
  };

  const handleEditPress = (txn: ITransaction) => {
    // Cannot edit pending (local) transactions
    if (txn.isLocal || txn._id.startsWith("temp_")) {
      return;
    }
    setEditingTxn(txn);
    setEditType(txn.type);
    setEditAmount(txn.amount.toString());
    setEditDescription(txn.description);
    setEditCategory(txn.category);
    setEditPaymentMethod(txn.paymentMethod);
    setEditSplitAmount((txn.splitAmount || 0).toString());
    setEditIsSplit((txn.splitAmount || 0) > 0);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTxn || !editAmount || !editDescription) return;
    
    setSaving(true);
    try {
      await updateTransaction(editingTxn._id, {
        type: editType,
        amount: parseFloat(editAmount),
        description: editDescription.trim(),
        category: editCategory || "General",
        paymentMethod: editPaymentMethod,
        splitAmount: editIsSplit ? parseFloat(editSplitAmount || "0") : 0,
      });
      setEditModalVisible(false);
      setEditingTxn(null);
    } catch (error: any) {
      // Show error via alert
      console.error("Failed to update:", error);
    } finally {
      setSaving(false);
    }
  };

  const availableMethods = paymentMethods.filter(
    (m) => profile?.paymentMethods?.includes(m.id)
  );

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
      {/* Top Bar with Internet Status */}
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
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing || syncing}
            style={{ padding: 4 }}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={syncing ? colors.textMuted : colors.text}
            />
          </TouchableOpacity>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: isOnline ? colors.success : colors.error,
            }}
          />
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Sync Status Banner */}
        <SyncStatusBanner />

        {transactions.length === 0 ? (
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
        ) : (
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            {paginatedTransactions.map((txn, index) => (
              <View
                key={txn._id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 16,
                  borderBottomWidth:
                    index < paginatedTransactions.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                >
                  <View
                    style={{
                      backgroundColor:
                        txn.type === "income" ? colors.successBg : colors.errorBg,
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <Ionicons
                      name={
                        txn.type === "income" ? "trending-up" : "trending-down"
                      }
                      size={20}
                      color={txn.type === "income" ? colors.success : colors.error}
                    />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      style={{
                        fontWeight: "600",
                        color: colors.text,
                        fontSize: 15,
                      }}
                      numberOfLines={1}
                    >
                      {txn.description}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textMuted,
                        marginTop: 2,
                      }}
                    >
                      {paymentMethodConfig[txn.paymentMethod]?.label} ·{" "}
                      {txn.category} · {formatDate(txn.date)}
                    </Text>
                    {txn.isLocal && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: 4,
                        }}
                      >
                        <Ionicons
                          name="cloud-upload-outline"
                          size={12}
                          color={colors.warning}
                        />
                        <Text
                          style={{
                            fontSize: 10,
                            color: colors.warning,
                            marginLeft: 4,
                          }}
                        >
                          Pending sync
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontWeight: "700",
                      fontSize: 16,
                      color:
                        txn.type === "income" ? colors.success : colors.error,
                    }}
                  >
                    {txn.type === "income" ? "+" : "-"}₹
                    {formatCurrency(txn.amount)}
                  </Text>
                  {txn.splitAmount && txn.splitAmount > 0 && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.splitwise,
                        marginTop: 2,
                      }}
                    >
                      Split: ₹{formatCurrency(txn.splitAmount)}
                    </Text>
                  )}
                </View>

                {/* Action buttons */}
                <View style={{ flexDirection: "row", marginLeft: 8 }}>
                  {/* Edit button - only show if not pending */}
                  {!txn.isLocal && !txn._id.startsWith("temp_") && (
                    <TouchableOpacity
                      style={{ padding: 8 }}
                      onPress={() => handleEditPress(txn)}
                    >
                      <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  
                  {/* Delete button */}
                  <TouchableOpacity
                    style={{ padding: 8 }}
                    onPress={() => handleDeletePress(txn)}
                    disabled={deleting === txn._id}
                  >
                    {deleting === txn._id ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Load More */}
        {hasMore && (
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
        )}

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={deleteModalVisible}
        onClose={() => {
          setDeleteModalVisible(false);
          setTransactionToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Transaction"
        message={`Are you sure you want to delete "${transactionToDelete?.description}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="destructive"
        icon="trash-outline"
        loading={deleting !== null}
      />

      {/* Edit Transaction Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setEditModalVisible(false)}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
            {/* Blur overlay */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: isDark ? "rgba(0, 0, 0, 0.7)" : "rgba(255, 255, 255, 0.7)",
              }}
            />
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <View
                  style={{
                    width: 340,
                    maxHeight: "90%",
                    backgroundColor: isDark ? "rgba(30, 30, 40, 0.98)" : "rgba(255, 255, 255, 0.98)",
                    borderRadius: 20,
                    padding: 20,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {/* Header */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
                      Edit Transaction
                    </Text>
                    <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                      <Ionicons name="close" size={24} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>
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
                        onPress={() => setEditType("income")}
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

                    {/* Description */}
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 6 }}>Description</Text>
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
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 6 }}>Category</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {CATEGORIES.map((cat) => (
                          <TouchableOpacity
                            key={cat.id}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 8,
                              backgroundColor: editCategory === cat.id ? colors.primary + "20" : colors.card,
                              borderWidth: 1,
                              borderColor: editCategory === cat.id ? colors.primary : colors.border,
                            }}
                            onPress={() => setEditCategory(cat.id)}
                          >
                            <Text style={{ color: editCategory === cat.id ? colors.primary : colors.text, fontSize: 13 }}>
                              {cat.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

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

                    {/* Save Button */}
                    <TouchableOpacity
                      style={{
                        backgroundColor: colors.primary,
                        borderRadius: 12,
                        padding: 14,
                        alignItems: "center",
                        marginTop: 8,
                      }}
                      onPress={handleSaveEdit}
                      disabled={saving || !editAmount || !editDescription}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                          Save Changes
                        </Text>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
