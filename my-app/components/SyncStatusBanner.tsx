import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useUserContext } from "../context/UserContext";
import { Colors } from "../constants/theme";

export default function SyncStatusBanner() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const { isOnline, syncing, pendingCount, manualRefresh } = useUserContext();
  const [refreshing, setRefreshing] = React.useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation when offline or syncing
  useEffect(() => {
    if (!isOnline || pendingCount > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline, pendingCount]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await manualRefresh();
    setRefreshing(false);
  };

  // Don't show banner when everything is fine (online, no pending, not syncing)
  if (isOnline && pendingCount === 0 && !syncing) {
    return null;
  }

  const getBannerConfig = () => {
    if (!isOnline) {
      return {
        bg: colors.warningBg,
        borderColor: colors.warning,
        icon: "cloud-offline" as const,
        iconColor: colors.warning,
        title: "You're Offline",
        subtitle: pendingCount > 0
          ? `${pendingCount} item${pendingCount > 1 ? "s" : ""} waiting to sync`
          : "Using cached data",
      };
    }

    if (syncing) {
      return {
        bg: colors.infoBg,
        borderColor: colors.info,
        icon: "cloud-upload" as const,
        iconColor: colors.info,
        title: "Syncing...",
        subtitle: "Uploading your changes",
      };
    }

    if (pendingCount > 0) {
      return {
        bg: colors.warningBg,
        borderColor: colors.warning,
        icon: "time" as const,
        iconColor: colors.warning,
        title: "Pending Sync",
        subtitle: `${pendingCount} item${pendingCount > 1 ? "s" : ""} waiting to sync`,
      };
    }

    return null;
  };

  const config = getBannerConfig();
  if (!config) return null;

  return (
    <Animated.View
      style={{
        opacity: !isOnline ? pulseAnim : 1,
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: config.bg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: config.borderColor,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      {syncing ? (
        <ActivityIndicator size="small" color={config.iconColor} />
      ) : (
        <Ionicons name={config.icon} size={20} color={config.iconColor} />
      )}

      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text
          style={{
            fontWeight: "600",
            fontSize: 13,
            color: config.iconColor,
          }}
        >
          {config.title}
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: config.iconColor,
            opacity: 0.8,
            marginTop: 1,
          }}
        >
          {config.subtitle}
        </Text>
      </View>

      {/* Refresh Button */}
      <TouchableOpacity
        onPress={handleRefresh}
        disabled={refreshing || syncing}
        style={{
          backgroundColor: isOnline
            ? colors.primary
            : "rgba(255,255,255,0.2)",
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {refreshing ? (
          <ActivityIndicator
            size="small"
            color={isOnline ? colors.primaryForeground : config.iconColor}
          />
        ) : (
          <>
            <Ionicons
              name="refresh"
              size={14}
              color={isOnline ? colors.primaryForeground : config.iconColor}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                marginLeft: 4,
                color: isOnline ? colors.primaryForeground : config.iconColor,
              }}
            >
              Sync
            </Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
