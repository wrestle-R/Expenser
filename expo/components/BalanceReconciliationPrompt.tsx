import { useCallback, useEffect, useRef } from "react";
import { Alert, AppState, type AppStateStatus } from "react-native";
import { api } from "../lib/api";
import { useUserContext } from "../context/UserContext";

export default function BalanceReconciliationPrompt() {
  const { profile, refreshProfile, syncing } = useUserContext();
  const activeAlertId = useRef<string | null>(null);

  const checkAlerts = useCallback(async () => {
      if (!profile) {
        return;
      }

      try {
        const alerts = await api.getBalanceAlerts();
        if (alerts.length === 0) {
          return;
        }

        const alert = alerts[0];
        if (activeAlertId.current === alert._id) {
          return;
        }

        activeAlertId.current = alert._id;
        Alert.alert(
          "Bank balance mismatch",
          `Bank SMS says Bank (UPI) is Rs ${alert.bankBalance.toFixed(
            2
          )}, but Expenser expected Rs ${alert.expectedBalance.toFixed(2)}.`,
          [
            {
              text: "Keep App Balance",
              style: "cancel",
              onPress: async () => {
                try {
                  await api.resolveBalanceAlert(alert._id, "keep");
                  await refreshProfile();
                } finally {
                  activeAlertId.current = null;
                }
              },
            },
            {
              text: "Use Bank Balance",
              onPress: async () => {
                try {
                  await api.resolveBalanceAlert(alert._id, "apply");
                  await refreshProfile();
                } finally {
                  activeAlertId.current = null;
                }
              },
            },
          ]
        );
      } catch (error) {
        console.error("[BalanceReconciliationPrompt] Error:", error);
      }
  }, [profile, refreshProfile]);

  useEffect(() => {
    let cancelled = false;

    if (!syncing) void checkAlerts();
    const subscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (!cancelled && state === "active") void checkAlerts();
      }
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [checkAlerts, syncing]);

  return null;
}
