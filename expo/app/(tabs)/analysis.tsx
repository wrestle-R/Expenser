import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, paymentMethodConfig } from "../../constants/theme";
import { useStealthMode } from "../../context/StealthContext";
import { useTheme } from "../../context/ThemeContext";
import { useUserContext } from "../../context/UserContext";
import { formatCurrency } from "../../lib/utils";

export default function AnalysisScreen() {
  const { isDark } = useTheme();
  const { isStealthMode, toggleStealthMode } = useStealthMode();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { transactions, loading, manualRefresh } = useUserContext();
  const [refreshing, setRefreshing] = useState(false);

  const analysis = useMemo(() => {
    const active = transactions.filter((transaction) => !transaction.deletedAt);
    const income = active
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expense = active
      .filter((transaction) => transaction.type === "expense")
      .reduce(
        (sum, transaction) =>
          sum + Math.max(0, transaction.amount - (transaction.splitAmount || 0)),
        0
      );
    const paymentMethodTotals = new Map<string, number>();

    for (const transaction of active) {
      if (transaction.type !== "expense") {
        continue;
      }

      const label =
        paymentMethodConfig[transaction.paymentMethod]?.label ||
        transaction.paymentMethod;
      paymentMethodTotals.set(
        label,
        (paymentMethodTotals.get(label) || 0) +
          Math.max(0, transaction.amount - (transaction.splitAmount || 0))
      );
    }

    const topPaymentMethods = Array.from(paymentMethodTotals.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5);

    return {
      income,
      expense,
      net: income - expense,
      count: active.length,
      topPaymentMethods,
    };
  }, [transactions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await manualRefresh();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.background,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const amount = (value: number) =>
    isStealthMode ? "₹••••••" : `₹${formatCurrency(value)}`;

  return (
    <View style={{ backgroundColor: colors.background, flex: 1, paddingTop: insets.top }}>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "bold" }}>
            Analysis
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 2 }}>
            {analysis.count} active transactions
          </Text>
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
            <Ionicons name="refresh-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleStealthMode} style={{ padding: 4 }}>
            <Ionicons
              name={isStealthMode ? "eye-off" : "eye"}
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ gap: 16, padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        style={{ flex: 1 }}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[
            { label: "Income", value: analysis.income, color: colors.success },
            { label: "Expense", value: analysis.expense, color: colors.error },
          ].map((item) => (
            <View
              key={item.label}
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: 16,
                borderWidth: 1,
                flex: 1,
                padding: 16,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {item.label}
              </Text>
              <Text
                style={{
                  color: item.color,
                  fontSize: 18,
                  fontVariant: ["tabular-nums"],
                  fontWeight: "700",
                  marginTop: 8,
                }}
              >
                {amount(item.value)}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 16,
            borderWidth: 1,
            padding: 18,
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Net flow</Text>
          <Text
            style={{
              color: analysis.net >= 0 ? colors.success : colors.error,
              fontSize: 28,
              fontVariant: ["tabular-nums"],
              fontWeight: "800",
              marginTop: 8,
            }}
          >
            {amount(analysis.net)}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 16,
            borderWidth: 1,
            padding: 18,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 18,
              fontWeight: "700",
              marginBottom: 12,
            }}
          >
            Top spending
          </Text>
          {analysis.topPaymentMethods.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>No expense data yet.</Text>
          ) : (
            analysis.topPaymentMethods.map((item) => (
              <View
                key={item.label}
                style={{
                  alignItems: "center",
                  borderTopColor: colors.border,
                  borderTopWidth: 1,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {item.label}
                </Text>
                <Text
                  style={{
                    color: colors.error,
                    fontVariant: ["tabular-nums"],
                    fontWeight: "700",
                  }}
                >
                  {amount(item.amount)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
