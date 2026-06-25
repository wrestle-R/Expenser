import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { api } from "../lib/api";
import { useUserContext } from "../context/UserContext";

export default function BalanceReconciliationPrompt() {
  const { profile, refreshProfile } = useUserContext();
  const activeAlertId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAlerts() {
      if (!profile) {
        return;
      }

      try {
        const alerts = await api.getBalanceAlerts();
        if (cancelled || alerts.length === 0) {
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
                await api.resolveBalanceAlert(alert._id, "keep");
                activeAlertId.current = null;
              },
            },
            {
              text: "Use Bank Balance",
              onPress: async () => {
                await api.resolveBalanceAlert(alert._id, "apply");
                await refreshProfile();
                activeAlertId.current = null;
              },
            },
          ]
        );
      } catch (error) {
        console.error("[BalanceReconciliationPrompt] Error:", error);
      }
    }

    checkAlerts();

    return () => {
      cancelled = true;
    };
  }, [profile, refreshProfile]);

  return null;
}
