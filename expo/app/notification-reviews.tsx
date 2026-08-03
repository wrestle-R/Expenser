import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ResponsiveModal from "../components/ResponsiveModal";
import { Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useUserContext } from "../context/UserContext";
import type { BankReviewEvent, TransactionType } from "../lib/types";

function suggestedType(event: BankReviewEvent): TransactionType {
  return /credit|refund|reversal|lien_removed/i.test(event.eventType)
    ? "income"
    : "expense";
}

export default function NotificationReviewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const { showToast } = useToast();
  const {
    addTransaction,
    bankReviewEvents,
    dismissBankReviewEvent,
    retryBankReviewEvent,
  } = useUserContext();
  const [selected, setSelected] = useState<BankReviewEvent | null>(null);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const retryableCount = bankReviewEvents.filter(
    (event) => event.rawMessage && event.sourceKey
  ).length;

  const openConversion = (event: BankReviewEvent) => {
    setSelected(event);
    setType(suggestedType(event));
    setAmount(event.amount == null ? "" : String(event.amount));
    setDescription(event.summary);
    setCategory("");
  };

  const retry = async (event: BankReviewEvent) => {
    setWorkingKey(event.importSourceKey);
    try {
      await retryBankReviewEvent(event.importSourceKey);
      showToast("Notification checked again", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not retry notification", "error");
    } finally {
      setWorkingKey(null);
    }
  };

  const dismiss = async (event: BankReviewEvent) => {
    setWorkingKey(event.importSourceKey);
    try {
      await dismissBankReviewEvent(event.importSourceKey);
    } finally {
      setWorkingKey(null);
    }
  };

  const convert = async () => {
    if (!selected) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast("Enter a valid amount", "error");
      return;
    }
    if (!category.trim()) {
      showToast("Enter a category", "error");
      return;
    }

    setSaving(true);
    try {
      await addTransaction({
        type,
        amount: parsedAmount,
        description: description.trim(),
        category: category.trim(),
        paymentMethod: "bank",
        splitAmount: 0,
        date: selected.occurredAt ?? selected.capturedAt ?? new Date().toISOString(),
        importSource: "sms_notification",
        importSourceKey: selected.sourceKey ?? selected.importSourceKey,
        importedAccountSuffix: selected.accountSuffix ?? undefined,
        importedBankConfidence: selected.confidence,
      });
      await dismissBankReviewEvent(selected.importSourceKey);
      setSelected(null);
      showToast("Transaction added", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not add transaction", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          accessibilityLabel="Close notification review"
          onPress={() => router.back()}
          style={{ padding: 8, marginLeft: -8 }}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>
            Notification Review
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
            {bankReviewEvents.length} to review · {retryableCount} retryable
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {bankReviewEvents.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: 16,
              borderWidth: 1,
              padding: 28,
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={40} color={colors.success} />
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700", marginTop: 12 }}>
              Nothing needs review
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 6, textAlign: "center" }}>
              Uncertain transaction messages will appear here instead of being discarded.
            </Text>
          </View>
        ) : (
          bankReviewEvents.map((event) => {
            const working = workingKey === event.importSourceKey;
            return (
              <View
                key={event.importSourceKey}
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: 16,
                  borderWidth: 1,
                  marginBottom: 12,
                  padding: 16,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                      {event.bankName || event.sender || "Bank message"}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      {event.eventType.replace(/_/g, " ")} · {event.parser || "local"}
                    </Text>
                  </View>
                  {event.amount != null && (
                    <Text style={{ color: colors.text, fontWeight: "700" }}>₹{event.amount}</Text>
                  )}
                </View>
                <Text style={{ color: colors.text, lineHeight: 20, marginTop: 12 }}>
                  {event.summary}
                </Text>
                {event.failureReason && (
                  <Text style={{ color: colors.warning, fontSize: 12, marginTop: 8 }}>
                    {event.failureReason}
                  </Text>
                )}
                {event.rawMessage && (
                  <Text
                    numberOfLines={3}
                    style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 }}
                  >
                    {event.rawMessage}
                  </Text>
                )}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                  <TouchableOpacity
                    onPress={() => openConversion(event)}
                    disabled={working}
                    style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
                  >
                    <Text style={{ color: colors.primaryForeground, fontWeight: "700" }}>Add transaction</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => retry(event)}
                    disabled={working || !event.rawMessage || !event.sourceKey}
                    style={{ borderColor: colors.border, borderRadius: 10, borderWidth: 1, opacity: event.rawMessage && event.sourceKey ? 1 : 0.45, paddingHorizontal: 12, paddingVertical: 10 }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "600" }}>Retry</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => dismiss(event)}
                    disabled={working}
                    style={{ paddingHorizontal: 12, paddingVertical: 10 }}
                  >
                    {working ? (
                      <ActivityIndicator size="small" color={colors.textMuted} />
                    ) : (
                      <Text style={{ color: colors.error, fontWeight: "600" }}>Dismiss</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <ResponsiveModal
        visible={selected !== null}
        onClose={() => setSelected(null)}
        loading={saving}
        contentStyle={{ padding: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 19, fontWeight: "700" }}>
              Add transaction
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>
              Check the details before saving.
            </Text>
          </View>
          <TouchableOpacity disabled={saving} onPress={() => setSelected(null)} style={{ padding: 6 }}>
            <Ionicons name="close" size={23} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            {(["expense", "income"] as TransactionType[]).map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setType(option)}
                style={{
                  alignItems: "center",
                  backgroundColor: type === option ? colors.primary : colors.backgroundSecondary,
                  borderRadius: 10,
                  flex: 1,
                  padding: 12,
                }}
              >
                <Text style={{ color: type === option ? colors.primaryForeground : colors.text, fontWeight: "700", textTransform: "capitalize" }}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {[
            { label: "Amount", value: amount, setter: setAmount, placeholder: "0.00", keyboardType: "decimal-pad" as const },
            { label: "Description (optional)", value: description, setter: setDescription, placeholder: "What was this for?", keyboardType: "default" as const },
            { label: "Category", value: category, setter: setCategory, placeholder: "e.g. Food", keyboardType: "default" as const },
          ].map((field) => (
            <View key={field.label} style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
                {field.label}
              </Text>
              <TextInput
                value={field.value}
                onChangeText={field.setter}
                keyboardType={field.keyboardType}
                placeholder={field.placeholder}
                placeholderTextColor={colors.textMuted}
                style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.text, fontSize: 16, padding: 12 }}
              />
            </View>
          ))}
          <TouchableOpacity
            disabled={saving}
            onPress={convert}
            style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, marginTop: 4, padding: 14 }}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "700" }}>Save transaction</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </ResponsiveModal>
    </View>
  );
}
