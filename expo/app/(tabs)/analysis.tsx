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
import Svg, { Circle } from "react-native-svg";

import { Colors, paymentMethodConfig } from "../../constants/theme";
import { useStealthMode } from "../../context/StealthContext";
import { useTheme } from "../../context/ThemeContext";
import { useUserContext } from "../../context/UserContext";
import { formatCurrency } from "../../lib/utils";

const CHART_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export default function AnalysisScreen() {
  const { isDark } = useTheme();
  const { isStealthMode, toggleStealthMode } = useStealthMode();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { transactions, loading, manualRefresh } = useUserContext();
  const [refreshing, setRefreshing] = useState(false);

  const analysis = useMemo(() => {
    const now = new Date();
    const active = transactions.filter((transaction) => !transaction.deletedAt);
    const currentMonthExpenses = active.filter((transaction) => {
      if (transaction.type !== "expense") {
        return false;
      }

      const transactionDate = new Date(transaction.date);
      if (Number.isNaN(transactionDate.getTime())) {
        return false;
      }

      return (
        transactionDate.getFullYear() === now.getFullYear() &&
        transactionDate.getMonth() === now.getMonth()
      );
    });
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

    const categoryTotals = new Map<string, number>();

    for (const transaction of currentMonthExpenses) {
      const label = transaction.category.trim() &&
        transaction.category.trim().toLowerCase() !== "bank import"
        ? transaction.category.trim()
        : "Uncategorized";

      categoryTotals.set(
        label,
        (categoryTotals.get(label) || 0) +
          Math.max(0, transaction.amount - (transaction.splitAmount || 0))
      );
    }

    const totalCurrentMonthExpense = Array.from(categoryTotals.values()).reduce(
      (sum, value) => sum + value,
      0
    );
    const currentMonthCategories = Array.from(categoryTotals.entries())
      .map(([label, amount], index) => ({
        label,
        amount,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((left, right) => right.amount - left.amount);

    return {
      income,
      expense,
      net: income - expense,
      count: active.length,
      topPaymentMethods,
      currentMonthCategories,
      currentMonthExpenseCount: currentMonthExpenses.length,
      totalCurrentMonthExpense,
      currentMonthLabel: now.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    };
  }, [transactions]);

  const donutChart = useMemo(() => {
    const size = 164;
    const strokeWidth = 22;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let progress = 0;

    const slices = analysis.currentMonthCategories.map((slice) => {
      const ratio =
        analysis.totalCurrentMonthExpense > 0
          ? slice.amount / analysis.totalCurrentMonthExpense
          : 0;
      const rawLength = ratio * circumference;
      const segmentLength = Math.max(rawLength - 4, 0);
      const chartSlice = {
        ...slice,
        percentage: ratio * 100,
        dashArray: `${segmentLength} ${circumference - segmentLength}`,
        dashOffset: -progress,
      };
      progress += rawLength;
      return chartSlice;
    });

    return {
      center: size / 2,
      circumference,
      radius,
      size,
      strokeWidth,
      slices,
    };
  }, [analysis.currentMonthCategories, analysis.totalCurrentMonthExpense]);

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
            }}
          >
            This month by category
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
            {analysis.currentMonthLabel} · {analysis.currentMonthExpenseCount} expense transactions
          </Text>

          {analysis.currentMonthCategories.length === 0 ? (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 28,
              }}
            >
              <Ionicons name="pie-chart-outline" size={34} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 10 }}>
                No current-month expense data yet.
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: "center", gap: 18, marginTop: 18 }}>
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Svg
                  width={donutChart.size}
                  height={donutChart.size}
                  viewBox={`0 0 ${donutChart.size} ${donutChart.size}`}
                >
                  <Circle
                    cx={donutChart.center}
                    cy={donutChart.center}
                    r={donutChart.radius}
                    stroke={colors.border}
                    strokeWidth={donutChart.strokeWidth}
                    fill="none"
                  />
                  {donutChart.slices.map((slice) => (
                    <Circle
                      key={slice.label}
                      cx={donutChart.center}
                      cy={donutChart.center}
                      r={donutChart.radius}
                      stroke={slice.color}
                      strokeWidth={donutChart.strokeWidth}
                      strokeDasharray={slice.dashArray}
                      strokeDashoffset={slice.dashOffset}
                      strokeLinecap="round"
                      fill="none"
                      transform={`rotate(-90 ${donutChart.center} ${donutChart.center})`}
                    />
                  ))}
                </Svg>
                <View
                  style={{
                    position: "absolute",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    Spent
                  </Text>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 18,
                      fontVariant: ["tabular-nums"],
                      fontWeight: "800",
                      marginTop: 4,
                    }}
                  >
                    {amount(analysis.totalCurrentMonthExpense)}
                  </Text>
                </View>
              </View>

              <View style={{ alignSelf: "stretch", gap: 10 }}>
                {donutChart.slices.map((slice) => (
                  <View
                    key={slice.label}
                    style={{
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ alignItems: "center", flex: 1, flexDirection: "row", marginRight: 12 }}>
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: slice.color,
                          marginRight: 10,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "600" }}>
                          {slice.label}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                          {slice.percentage.toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        color: colors.text,
                        fontVariant: ["tabular-nums"],
                        fontWeight: "700",
                      }}
                    >
                      {amount(slice.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
