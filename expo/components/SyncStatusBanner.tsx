import { Text, TouchableOpacity, View } from "react-native";
import type { SyncStatus } from "../lib/sync";
import { syncMessage } from "../lib/sync-message";
import { Colors } from "../constants/theme";

export default function SyncStatusBanner({ status, colors, onRetry, onSignIn }: {
  status: SyncStatus; colors: typeof Colors.light; onRetry: () => void; onSignIn: () => void;
}) {
  const message = syncMessage(status);
  return <View accessibilityLiveRegion="polite" style={{ marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: message.tone === "warning" ? colors.warning : colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>{message.title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 }}>{message.detail}</Text>
    </View>
    {message.action && <TouchableOpacity accessibilityRole="button" onPress={message.action === "Sign in" ? onSignIn : onRetry} disabled={status.isSyncing} style={{ padding: 10, backgroundColor: colors.muted, borderRadius: 8 }}>
      <Text style={{ color: colors.text, fontWeight: "600" }}>{message.action}</Text>
    </TouchableOpacity>}
  </View>;
}
