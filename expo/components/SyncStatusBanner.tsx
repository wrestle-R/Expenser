import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { SyncStatus } from "../lib/sync";
import { syncMessage } from "../lib/sync-message";
import type { Colors } from "../constants/theme";

export default function SyncStatusBanner({ status, colors, onRetry, onSignIn }: {
  status: SyncStatus; colors: typeof Colors.light; onRetry: () => void; onSignIn: () => void;
}) {
  if (status.isOnline && !status.isSyncing && !status.error && !status.pendingChanges && !status.rejectedChanges) {
    return null;
  }

  const message = syncMessage(status);
  const tint = message.tone === "warning" ? colors.warning : colors.textMuted;
  const showDetail = Boolean(status.error || status.pendingChanges || status.rejectedChanges);
  return (
    <View accessibilityLiveRegion="polite" style={styles.row}>
      <Ionicons name={message.tone === "warning" ? "alert-circle-outline" : "cloud-outline"} size={17} color={tint} />
      <View style={styles.message}>
        <Text style={[styles.title, { color: tint }]}>{message.title}</Text>
        {showDetail && <Text style={[styles.detail, { color: colors.textMuted }]}>{message.detail}</Text>}
      </View>
      {message.action && (
        <TouchableOpacity accessibilityRole="button" onPress={message.action === "Sign in" ? onSignIn : onRetry}
          disabled={status.isSyncing} style={styles.action}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>{message.action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 8, minHeight: 28 },
  message: { flex: 1 },
  title: { fontWeight: "600", fontSize: 13 },
  detail: { fontSize: 12, lineHeight: 16 },
  action: { minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
});
