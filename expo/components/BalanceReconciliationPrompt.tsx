import { useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { api } from "../lib/api";
import { createBalancePromptCycle } from "../lib/balance-prompt-cycle.js";
import { useUserContext } from "../context/UserContext";

export default function BalanceReconciliationPrompt() {
  const { profile, refreshProfile, syncing, isOnline, loading } = useUserContext();
  const userId = profile?.userId;
  const cycle = useRef(createBalancePromptCycle());
  const visible = useRef(false);
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Invalidate a pending read when leaving the screen or switching accounts.
    return () => cycle.current.reset();
  }, [appState, userId]);

  useEffect(() => {
    if (appState !== "active" || !userId || !isOnline || syncing || loading) return;

    void cycle.current.check(
      async () => (await api.getBalanceAlerts())[0],
      (alert) => {
        if (visible.current) return false;
        visible.current = true;

        const resolve = async (action: "apply" | "keep") => {
          try {
            await api.resolveBalanceAlert(alert._id, action);
            await refreshProfile();
          } catch {
            Alert.alert("Could not update balance", "Please check your connection and try again.");
          } finally {
            visible.current = false;
          }
        };

        Alert.alert(
          "Bank balance mismatch",
          `Bank SMS says Bank (UPI) is Rs ${alert.bankBalance.toFixed(2)}, but Expenser expected Rs ${alert.expectedBalance.toFixed(2)}.`,
          [
            { text: "Later", style: "cancel", onPress: () => { visible.current = false; } },
            { text: "Keep App Balance", onPress: () => void resolve("keep") },
            { text: "Use Bank Balance", onPress: () => void resolve("apply") },
          ],
          { cancelable: true, onDismiss: () => { visible.current = false; } },
        );
        return true;
      },
    ).catch(() => console.warn("[Balance] Could not check the latest balance alert."));
  }, [appState, userId, isOnline, syncing, loading, refreshProfile]);

  return null;
}
