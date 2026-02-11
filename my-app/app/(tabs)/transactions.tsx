import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/context/ThemeContext";
import { useUserContext } from "@/context/UserContext";
import { Colors, paymentMethodConfig } from "@/constants/theme";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ITransaction } from "@/lib/types";

const PAGE_SIZE = 10;

export default function TransactionsScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    transactions,
    loading,
    refreshTransactions,
    deleteTransaction,
    isOnline,
  } = useUserContext();

  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshTransactions();
    setRefreshing(false);
  };

  const paginatedTransactions = transactions.slice(0, page * PAGE_SIZE);
  const hasMore = transactions.length > page * PAGE_SIZE;

  const handleDelete = async (txn: ITransaction) => {
    Alert.alert(
      "Delete Transaction",
      `Are you sure you want to delete "${txn.description}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(txn._id);
            try {
              await deleteTransaction(txn._id);
            } catch (error) {
              Alert.alert("Error", "Failed to delete transaction");
            } finally {
              setDeleting(null);
            }
          },
        },
      ]
    );
  };

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
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

                <TouchableOpacity
                  style={{ marginLeft: 12, padding: 8 }}
                  onPress={() => handleDelete(txn)}
                  disabled={deleting === txn._id}
                >
                  {deleting === txn._id ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  )}
                </TouchableOpacity>
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
    </View>
  );
}
