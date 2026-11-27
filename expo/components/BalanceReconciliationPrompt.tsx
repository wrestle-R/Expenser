import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import ResponsiveModal from "./ResponsiveModal";
import { Colors } from "../constants/theme";
import { useStealthMode } from "../context/StealthContext";
import { useTheme } from "../context/ThemeContext";
import { useUserContext } from "../context/UserContext";
import { api, ApiError } from "../lib/api";
import { getBankImportQueueSnapshot } from "../lib/bank-imports";
import { createBalancePromptCycle } from "../lib/balance-prompt-cycle.js";
import type { BalanceReconciliationAlert } from "../lib/types";
import { formatCurrency } from "../lib/utils";

export default function BalanceReconciliationPrompt() {
  const { profile, refreshProfile, syncing, isOnline, loading, bankImportStatus } = useUserContext();
  const { isDark } = useTheme();
  const { isStealthMode } = useStealthMode();
  const colors = isDark ? Colors.dark : Colors.light;
  const userId = profile?.userId;
  const seenKey = `balance-prompt:last-shown:${userId}`;
  const cycle = useRef(createBalancePromptCycle());
  const [appState, setAppState] = useState(AppState.currentState);
  const [alert, setAlert] = useState<BalanceReconciliationAlert>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const current = cycle.current;
    return () => current.reset();
  }, [appState, userId]);

  useEffect(() => {
    if (appState !== "active" || !userId || !isOnline || syncing || loading || alert || isStealthMode) return;
    const queue = getBankImportQueueSnapshot();
    if (queue.candidates || queue.parsed) return;

    void cycle.current.check(async () => {
      const [alerts, lastShown] = await Promise.all([
        api.getBalanceAlerts(),
        AsyncStorage.getItem(seenKey).catch(() => null),
      ]);
      const latest = alerts[0];
      return latest?._id === lastShown ? undefined : latest;
    }, (latest) => {
      setError("");
      setAlert(latest);
      void AsyncStorage.setItem(seenKey, latest._id).catch(() => {});
      return true;
    }).catch(() => console.warn("[Balance] Could not check the latest balance alert."));
  }, [appState, userId, isOnline, syncing, loading, alert, seenKey, isStealthMode, bankImportStatus.queuedCandidates]);

  const resolve = async (action: "apply" | "keep") => {
    if (!alert || saving) return;
    setSaving(true);
    setError("");
    try {
      await api.resolveBalanceAlert(alert._id, action);
      setAlert(undefined);
      await refreshProfile();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const [latest] = await api.getBalanceAlerts();
          setAlert(latest);
          if (latest) await AsyncStorage.setItem(seenKey, latest._id).catch(() => {});
        } catch {
          setError("Couldn’t check for a newer balance. Try again.");
        }
      } else {
        setError("Couldn’t save your choice. Try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal visible={Boolean(alert && alert.userId === userId && !isStealthMode)}
      onClose={() => setAlert(undefined)} loading={saving} maxWidth={400}>
      {alert && (
        <ScrollView bounces={false} contentContainerStyle={styles.content}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Check your bank balance</Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>
              Your latest bank SMS shows a different balance. Choose which balance Expenser should use.
            </Text>
          </View>
          <View style={[styles.amounts, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.amountRow}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Latest bank SMS</Text>
              <Text style={[styles.amount, { color: colors.text }]}>₹{formatCurrency(alert.bankBalance)}</Text>
            </View>
            <View style={[styles.amountRow, styles.divider, { borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Expenser</Text>
              <Text style={[styles.amount, { color: colors.text }]}>₹{formatCurrency(alert.expectedBalance)}</Text>
            </View>
          </View>
          {!!error && <Text accessibilityRole="alert" style={{ color: colors.text }}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => void resolve("apply")}
              style={[styles.button, { backgroundColor: colors.primary }]}>
              {saving && <ActivityIndicator color={colors.primaryForeground} />}
              <Text style={[styles.buttonLabel, { color: colors.primaryForeground }]}>Use bank balance</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => void resolve("keep")}
              style={[styles.button, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.buttonLabel, { color: colors.text }]}>Keep Expenser balance</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => setAlert(undefined)} style={styles.button}>
              <Text style={[styles.buttonLabel, { color: colors.textMuted }]}>Later</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </ResponsiveModal>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  heading: { gap: 6 },
  title: { fontSize: 21, fontWeight: "700" },
  description: { fontSize: 15, lineHeight: 21 },
  amounts: { paddingHorizontal: 14, borderRadius: 12 },
  amountRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 6, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 14 },
  amount: { fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] },
  actions: { gap: 8 },
  button: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", minHeight: 46, borderRadius: 10, padding: 10 },
  buttonLabel: { flexShrink: 1, fontSize: 15, fontWeight: "600", textAlign: "center" },
});
