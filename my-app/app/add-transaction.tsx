import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../context/ThemeContext";
import { useUserContext } from "../context/UserContext";
import { useToast } from "../context/ToastContext";
import { Colors, CATEGORIES, paymentMethodConfig } from "../constants/theme";
import { TransactionType, PaymentMethod } from "../lib/types";

const paymentMethods: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: "bank", label: "Bank (UPI)", icon: "card" },
  { id: "cash", label: "Cash", icon: "cash" },
  { id: "splitwise", label: "Splitwise", icon: "swap-horizontal" },
];

export default function AddTransactionScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const params = useLocalSearchParams();
  const { addTransaction, profile } = useUserContext();
  const { showToast } = useToast();

  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank");
  const [splitAmount, setSplitAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill from workflow params
  useEffect(() => {
    if (params.type) setType(params.type as TransactionType);
    if (params.amount) setAmount(params.amount as string);
    if (params.description) setDescription(params.description as string);
    if (params.category) setCategory(params.category as string);
    if (params.paymentMethod)
      setPaymentMethod(params.paymentMethod as PaymentMethod);
    if (params.splitAmount) setSplitAmount(params.splitAmount as string);
  }, [params]);

  // Filter payment methods based on user's profile
  const availableMethods = paymentMethods.filter(
    (m) => profile?.paymentMethods?.includes(m.id)
  );

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount))) {
      showToast("Please enter a valid amount", "error");
      return;
    }

    if (!description.trim()) {
      showToast("Please enter a description", "error");
      return;
    }

    setSaving(true);
    try {
      await addTransaction({
        type,
        amount: parseFloat(amount),
        description: description.trim(),
        category,
        paymentMethod,
        splitAmount: splitAmount ? parseFloat(splitAmount) : 0,
        date: new Date().toISOString(),
      });
      showToast("Transaction added successfully", "success");
      router.back();
    } catch (error) {
      showToast("Failed to add transaction", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type Selector */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: 8,
            }}
          >
            Transaction Type
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 12,
                backgroundColor:
                  type === "expense" ? colors.errorBg : colors.card,
                borderWidth: 2,
                borderColor:
                  type === "expense" ? colors.error : colors.border,
                alignItems: "center",
              }}
              onPress={() => setType("expense")}
            >
              <Ionicons
                name="arrow-down"
                size={24}
                color={type === "expense" ? colors.error : colors.textMuted}
              />
              <Text
                style={{
                  marginTop: 8,
                  fontWeight: "600",
                  color: type === "expense" ? colors.error : colors.textMuted,
                }}
              >
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 12,
                backgroundColor:
                  type === "income" ? colors.successBg : colors.card,
                borderWidth: 2,
                borderColor:
                  type === "income" ? colors.success : colors.border,
                alignItems: "center",
              }}
              onPress={() => setType("income")}
            >
              <Ionicons
                name="arrow-up"
                size={24}
                color={type === "income" ? colors.success : colors.textMuted}
              />
              <Text
                style={{
                  marginTop: 8,
                  fontWeight: "600",
                  color: type === "income" ? colors.success : colors.textMuted,
                }}
              >
                Income
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Amount */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: 8,
            }}
          >
            Amount
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 16,
            }}
          >
            <Text style={{ fontSize: 24, color: colors.text, marginRight: 8 }}>
              ₹
            </Text>
            <TextInput
              style={{
                flex: 1,
                fontSize: 24,
                fontWeight: "600",
                color: colors.text,
                paddingVertical: 16,
              }}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </View>

        {/* Description */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: 8,
            }}
          >
            Description
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 16,
              color: colors.text,
            }}
            placeholder="What was this for?"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Category */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: 8,
            }}
          >
            Category
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor:
                    category === cat.id
                      ? isDark
                        ? `${cat.color}30`
                        : `${cat.color}20`
                      : colors.card,
                  borderWidth: 1,
                  borderColor:
                    category === cat.id ? cat.color : colors.border,
                }}
                onPress={() => setCategory(cat.id)}
              >
                <Text
                  style={{
                    color: category === cat.id ? cat.color : colors.textMuted,
                    fontWeight: "500",
                  }}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Payment Method */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMuted,
              marginBottom: 8,
            }}
          >
            Payment Method
          </Text>
          <View style={{ gap: 8 }}>
            {availableMethods.map((method) => {
              const config = paymentMethodConfig[method.id];
              const isSelected = paymentMethod === method.id;
              const methodColor = isDark ? config.darkColor : config.lightColor;
              const methodBg = isDark ? config.darkBg : config.lightBg;

              return (
                <TouchableOpacity
                  key={method.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: isSelected ? methodBg : colors.card,
                    borderWidth: 1,
                    borderColor: isSelected ? methodColor : colors.border,
                  }}
                  onPress={() => setPaymentMethod(method.id)}
                >
                  <Ionicons
                    name={method.icon as any}
                    size={24}
                    color={isSelected ? methodColor : colors.textMuted}
                  />
                  <Text
                    style={{
                      marginLeft: 12,
                      fontSize: 16,
                      fontWeight: "500",
                      color: isSelected ? methodColor : colors.text,
                    }}
                  >
                    {method.label}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={methodColor}
                      style={{ marginLeft: "auto" }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Split Amount (optional) */}
        {paymentMethod === "splitwise" && (
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.textMuted,
                marginBottom: 8,
              }}
            >
              Split Amount (Your Share)
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 16,
              }}
            >
              <Text
                style={{ fontSize: 20, color: colors.text, marginRight: 8 }}
              >
                ₹
              </Text>
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 20,
                  color: colors.text,
                  paddingVertical: 14,
                }}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={splitAmount}
                onChangeText={setSplitAmount}
              />
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            marginTop: 8,
            marginBottom: 32,
            opacity: saving ? 0.7 : 1,
          }}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text
              style={{
                color: colors.primaryForeground,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              Add Transaction
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
