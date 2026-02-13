import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../context/ThemeContext";
import { useUserContext } from "../../context/UserContext";
import { Colors, paymentMethodConfig } from "../../constants/theme";
import { formatCurrency, formatDate } from "../../lib/utils";
import SyncStatusBanner from "../../components/SyncStatusBanner";

export default function HomeScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    profile,
    transactions,
    workflows,
    loading,
    syncing,
    isOnline,
    pendingCount,
    refreshAll,
    manualRefresh,
    getBalance,
    getTotalBalance,
  } = useUserContext();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await manualRefresh();
    setRefreshing(false);
  };

  const recentTransactions = transactions.slice(0, 5);
  const totalBalance = getTotalBalance();

  const handleWorkflowPress = (workflow: any) => {
    // Navigate to transactions with workflow data prefilled
    router.push({
      pathname: "/add-transaction",
      params: {
        workflowId: workflow._id,
        type: workflow.type,
        amount: workflow.amount?.toString() || "",
        description: workflow.description,
        category: workflow.category,
        paymentMethod: workflow.paymentMethod,
        splitAmount: workflow.splitAmount?.toString() || "0",
      },
    });
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
        <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text }}>
          Expenser
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
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
        {/* Greeting */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "bold",
              color: colors.text,
            }}
          >
            Welcome back, {profile?.name?.split(" ")[0] || "User"}!
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>
            Here's your financial overview
          </Text>
        </View>

        {/* Sync Status Banner */}
        <SyncStatusBanner />

      {/* Total Balance Card */}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View>
            <Text
              style={{ fontSize: 14, color: colors.textMuted, fontWeight: "500" }}
            >
              Total Balance
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
              <Text style={{ fontSize: 32, fontWeight: "bold", color: colors.text }}>
                ₹{formatCurrency(totalBalance)}
              </Text>
            </View>
          </View>
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
        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
          Across {profile?.paymentMethods?.length || 0} payment method
          {(profile?.paymentMethods?.length || 0) !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Balance Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 24 }}
        contentContainerStyle={{ gap: 12 }}
      >
        {profile?.paymentMethods?.map((method) => {
          const config = paymentMethodConfig[method as keyof typeof paymentMethodConfig];
          const balance = getBalance(method as "bank" | "cash" | "splitwise");
          const methodColor = isDark ? config?.darkColor : config?.lightColor;
          const methodBg = isDark ? config?.darkBg : config?.lightBg;

          return (
            <View
              key={method}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                minWidth: 140,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    backgroundColor: methodBg,
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <Ionicons
                    name={
                      method === "bank"
                        ? "card"
                        : method === "cash"
                        ? "cash"
                        : "swap-horizontal"
                    }
                    size={18}
                    color={methodColor}
                  />
                </View>
                <Text
                  style={{
                    marginLeft: 8,
                    fontWeight: "500",
                    color: colors.text,
                  }}
                >
                  {config?.label || method}
                </Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text }}>
                ₹{formatCurrency(balance)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Quick Actions - Workflows */}
      {workflows.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>
              Quick Actions
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/workflows")}>
              <Text style={{ color: colors.primary, fontSize: 14 }}>View All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {workflows.slice(0, 5).map((workflow) => (
              <TouchableOpacity
                key={workflow._id}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  minWidth: 160,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                onPress={() => handleWorkflowPress(workflow)}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons
                    name="flash"
                    size={16}
                    color={
                      workflow.type === "income" ? colors.success : colors.error
                    }
                  />
                  <Text
                    style={{
                      marginLeft: 8,
                      fontWeight: "600",
                      color: colors.text,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {workflow.name}
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    marginTop: 4,
                  }}
                  numberOfLines={1}
                >
                  {workflow.description}
                </Text>
                {workflow.amount && workflow.amount > 0 && (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color:
                        workflow.type === "income" ? colors.success : colors.error,
                      marginTop: 8,
                    }}
                  >
                    {workflow.type === "income" ? "+" : "-"}₹
                    {formatCurrency(workflow.amount)}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Recent Transactions */}
      <View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>
            Recent Transactions
          </Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
            <Text style={{ color: colors.primary, fontSize: 14 }}>View All</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          {recentTransactions.length === 0 ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: colors.textMuted }}>No transactions yet.</Text>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  marginTop: 12,
                }}
                onPress={() => router.push("/add-transaction")}
              >
                <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>
                  Add your first transaction
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentTransactions.map((txn, index) => (
              <View
                key={txn._id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 16,
                  borderBottomWidth: index < recentTransactions.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <View
                    style={{
                      backgroundColor:
                        txn.type === "income" ? colors.successBg : colors.errorBg,
                      borderRadius: 8,
                      padding: 8,
                    }}
                  >
                    <Ionicons
                      name={txn.type === "income" ? "trending-up" : "trending-down"}
                      size={16}
                      color={txn.type === "income" ? colors.success : colors.error}
                    />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      style={{ fontWeight: "500", color: colors.text }}
                      numberOfLines={1}
                    >
                      {txn.description}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      {paymentMethodConfig[txn.paymentMethod]?.label} · {formatDate(txn.date)}
                      {txn.isLocal && " · Pending sync"}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    fontWeight: "600",
                    color: txn.type === "income" ? colors.success : colors.error,
                  }}
                >
                  {txn.type === "income" ? "+" : "-"}₹{formatCurrency(txn.amount)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Bottom spacing */}
      <View style={{ height: 32 }} />
    </ScrollView>
    </View>
  );
}
