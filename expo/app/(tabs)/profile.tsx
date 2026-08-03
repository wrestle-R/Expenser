import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../context/ThemeContext";
import { useUserContext } from "../../context/UserContext";
import { useTabPreferences } from "../../context/TabPreferencesContext";
import { Colors, paymentMethodConfig } from "../../constants/theme";
import { clearAllData } from "../../lib/storage";
import ConfirmModal from "../../components/ConfirmModal";
import { supabase } from "../../lib/supabase";
import type { BottomTabSlot } from "../../lib/types";
import {
  getBankNotificationAccessHealth,
  openBankNotificationAccessSettings,
  type NativeNotificationAccessHealth,
} from "../../lib/bank-imports";

const paymentOptions = [
  { id: "bank", label: "Bank (UPI)", icon: "card" as const },
  { id: "cash", label: "Cash", icon: "cash" as const },
  { id: "splitwise", label: "Splitwise", icon: "swap-horizontal" as const },
];
const TAB_OPTIONS: { id: BottomTabSlot; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "transactions", label: "Transactions", icon: "card-outline" },
  { id: "workflows", label: "Workflows", icon: "flash-outline" },
  { id: "analysis", label: "Analysis", icon: "pie-chart-outline" },
  { id: "empty", label: "Empty", icon: "remove-circle-outline" },
];
const EMPTY_ACCESS_HEALTH: NativeNotificationAccessHealth = {
  settingEnabled: false,
  recentReadCount: 0,
  lastReadAt: null,
  hasRecentReads: false,
  defaultSmsPackage: null,
  queuedCandidateCount: 0,
  queuedReviewEventCount: 0,
  legacyParsedCount: 0,
};

function formatLastRead(value: string | null) {
  if (!value) {
    return "never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return date.toLocaleString();
}

export default function ProfileScreen() {
  const { isDark, toggleTheme } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    profile,
    loading,
    isOnline,
    manualRefresh,
    transactions,
    bankReviewEvents,
    bankImportStatus,
    updateProfile,
  } = useUserContext();
  const { slots, updateSlots } = useTabPreferences();
  const hydratedProfileRef = useRef(false);

  const [name, setName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [accessHealth, setAccessHealth] = useState<NativeNotificationAccessHealth>(EMPTY_ACCESS_HEALTH);
  const pendingReviewTransactions = transactions.filter(
    (transaction) => transaction.reviewStatus === "needs_category"
  );
  const firstPendingReviewId = pendingReviewTransactions[0]?._id;

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setOccupation(profile.occupation || "");
      setSelectedMethods(profile.paymentMethods || []);
      hydratedProfileRef.current = true;
    }
  }, [profile]);

  const refreshSetup = useCallback(async () => {
    setAccessHealth(getBankNotificationAccessHealth());
  }, []);

  useEffect(() => {
    refreshSetup();
  }, [refreshSetup]);

  const toggleMethod = (id: string) => {
    setSelectedMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (!profile || !hydratedProfileRef.current || selectedMethods.length === 0) {
      return;
    }

    const nextName = name.trim();
    const nextOccupation = occupation.trim();
    const sameProfile =
      nextName === (profile.name || "") &&
      nextOccupation === (profile.occupation || "") &&
      selectedMethods.join("|") === (profile.paymentMethods || []).join("|");

    if (sameProfile) {
      return;
    }

    const timeout = setTimeout(() => {
      setSaveStatus("saving");
      updateProfile({
        name: nextName,
        occupation: nextOccupation,
        paymentMethods: selectedMethods,
        onboarded: true,
      })
        .then(() => {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 1600);
        })
        .catch((error) => {
          console.error("[Profile] Autosave failed:", error);
          setSaveStatus("error");
        });
    }, 650);

    return () => clearTimeout(timeout);
  }, [name, occupation, profile, selectedMethods, updateProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshSetup(), manualRefresh()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    setShowSignOutConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    setShowSignOutConfirm(false);
    try {
      await clearAllData();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const openPendingReview = () => {
    if (firstPendingReviewId) {
      router.push({
        pathname: "/transactions",
        params: { reviewId: firstPendingReviewId },
      });
      return;
    }

    router.push("/transactions");
  };

  const openNotificationReview = () => {
    router.push("/notification-reviews" as Href);
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Top Bar with Internet Status */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
        >
          <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>
            Profile
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity onPress={refreshSetup} style={{ padding: 4 }}>
              <Ionicons name="refresh-outline" size={20} color={colors.text} />
            </TouchableOpacity>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: isOnline ? colors.success : colors.error,
              }}
            />
          </View>
        </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* User Card */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.primary,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontSize: 32,
              fontWeight: "bold",
              color: colors.primaryForeground,
              textTransform: "uppercase",
            }}
          >
            {profile?.name?.[0] || "U"}
          </Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: "600", color: colors.text }}>
          {profile?.name || "User"}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 4 }}>
          {profile?.email || ""}
        </Text>

        {/* Status */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 12,
            backgroundColor: colors.successBg,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.success,
              marginRight: 6,
            }}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: colors.success,
              textTransform: "uppercase",
            }}
          >
            Active
          </Text>
        </View>

        {/* Sync Status */}
        {!isOnline && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 12,
              backgroundColor: colors.warningBg,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
            }}
          >
            <Ionicons name="cloud-offline" size={14} color={colors.warning} />
            <Text
              style={{
                fontSize: 12,
                color: colors.warning,
                marginLeft: 6,
              }}
            >
              Offline — changes upload automatically
            </Text>
          </View>
        )}
      </View>

      {/* Form */}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: colors.text,
            marginBottom: 16,
          }}
        >
          Personal Information
        </Text>

        {/* Name */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "500",
              color: colors.text,
              marginBottom: 8,
            }}
          >
            Name
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 12,
              paddingHorizontal: 16,
              fontSize: 16,
              color: colors.text,
            }}
            placeholder="Enter your name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Occupation */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "500",
              color: colors.text,
              marginBottom: 8,
            }}
          >
            Occupation
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 12,
              paddingHorizontal: 16,
              fontSize: 16,
              color: colors.text,
            }}
            placeholder="Enter your occupation"
            placeholderTextColor={colors.textMuted}
            value={occupation}
            onChangeText={setOccupation}
          />
        </View>

        {/* Payment Methods */}
        <View>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "500",
              color: colors.text,
              marginBottom: 8,
            }}
          >
            Payment Methods
          </Text>
          <View style={{ gap: 8 }}>
            {paymentOptions.map((option) => {
              const isSelected = selectedMethods.includes(option.id);
              const config =
                paymentMethodConfig[option.id as keyof typeof paymentMethodConfig];
              const methodColor = isDark ? config?.darkColor : config?.lightColor;
              const methodBg = isDark ? config?.darkBg : config?.lightBg;

              return (
                <TouchableOpacity
                  key={option.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: isSelected ? methodColor : colors.border,
                    backgroundColor: isSelected ? methodBg : "transparent",
                  }}
                  onPress={() => toggleMethod(option.id)}
                >
                  <View
                    style={{
                      backgroundColor: methodBg,
                      borderRadius: 8,
                      padding: 8,
                    }}
                  >
                    <Ionicons name={option.icon} size={18} color={methodColor} />
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: 12,
                      fontWeight: "500",
                      color: colors.text,
                    }}
                  >
                    {option.label}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={methodColor}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Appearance */}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: colors.text,
            marginBottom: 16,
          }}
        >
          Appearance
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderRadius: 8,
                padding: 8,
              }}
            >
              <Ionicons
                name={isDark ? "moon" : "sunny"}
                size={18}
                color={colors.text}
              />
            </View>
            <Text
              style={{
                marginLeft: 12,
                fontWeight: "500",
                color: colors.text,
              }}
            >
              Dark Mode
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.card}
          />
        </View>
      </View>

      {saveStatus !== "idle" && (
        <Text
          style={{
            color:
              saveStatus === "error"
                ? colors.error
                : saveStatus === "saved"
                  ? colors.success
                  : colors.textMuted,
            fontSize: 12,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          {saveStatus === "saving"
            ? "Saving changes..."
            : saveStatus === "saved"
              ? "Saved"
              : "Autosave failed"}
        </Text>
      )}

      {/* Bottom Tabs */}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: colors.text,
            marginBottom: 6,
          }}
        >
          Bottom Bar
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: 14 }}>
          Home and Profile stay fixed. Choose the three middle slots.
        </Text>
        {slots.map((slot, slotIndex) => (
          <View key={slotIndex} style={{ marginBottom: slotIndex === 2 ? 0 : 14 }}>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                fontWeight: "600",
                marginBottom: 8,
              }}
            >
              Slot {slotIndex + 1}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {TAB_OPTIONS.map((option) => {
                const selected = slot === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => {
                      const nextSlots = [...slots];
                      nextSlots[slotIndex] = option.id;
                      updateSlots(nextSlots).catch((error) =>
                        console.error("[Profile] Failed to update tabs:", error)
                      );
                    }}
                    style={{
                      alignItems: "center",
                      backgroundColor: selected
                        ? colors.primary
                        : colors.backgroundSecondary,
                      borderRadius: 999,
                      flexDirection: "row",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                    }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={15}
                      color={selected ? colors.primaryForeground : colors.text}
                    />
                    <Text
                      style={{
                        color: selected ? colors.primaryForeground : colors.text,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      {/* Bank SMS Import */}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: colors.text,
            marginBottom: 12,
          }}
        >
          Bank SMS Import
        </Text>
        <Text style={{ color: colors.textMuted }}>
          Permission: {accessHealth.settingEnabled ? "enabled" : "needs attention"}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Messages activity: {accessHealth.hasRecentReads ? "detected" : "waiting for a Messages notification"}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Last notification read: {formatLastRead(accessHealth.lastReadAt)}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Default Messages app: {accessHealth.defaultSmsPackage || "not detected"}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Queue: {bankImportStatus.queuedCandidates} waiting
          {bankImportStatus.retrying ? " · retrying" : ""}
          {` · ${bankImportStatus.queuedNativeReviews} native review`}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Review inbox: {bankReviewEvents.length}
          {` · ${pendingReviewTransactions.length} need a category`}
        </Text>
        <TouchableOpacity
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 14,
          }}
          onPress={openNotificationReview}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12 }}>
            <Ionicons name="mail-unread-outline" size={18} color={colors.primary} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "600" }}>
                Notification review inbox
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {bankReviewEvents.length > 0
                  ? `${bankReviewEvents.length} ${bankReviewEvents.length === 1 ? "message" : "messages"} need a decision`
                  : "No uncertain messages"}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 12 }}>
          Only notifications from the phone&apos;s default SMS app are inspected. Message bodies stay on this phone unless a transaction-like message needs parsing.
        </Text>
        <TouchableOpacity
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 14,
          }}
          onPress={openPendingReview}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12 }}>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "600" }}>
                Transactions needing a category
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {pendingReviewTransactions.length > 0
                  ? `${pendingReviewTransactions.length} ready to review`
                  : "Open transactions"}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
            marginTop: 14,
          }}
          onPress={openBankNotificationAccessSettings}
        >
          <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>
            Open Android Notification Access
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={{
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.error,
        }}
        onPress={handleSignOut}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text
            style={{
              color: colors.error,
              fontSize: 16,
              fontWeight: "600",
              marginLeft: 8,
            }}
          >
            Sign Out
          </Text>
        </View>
      </TouchableOpacity>

      {/* Bottom spacing */}
      <View style={{ height: 32 }} />
      </ScrollView>

      {/* Sign Out Confirmation Modal */}
      <ConfirmModal
        visible={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={handleConfirmSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out of Expenser?"
        confirmText="Sign Out"
        cancelText="Cancel"
        confirmColor="destructive"
        icon="log-out-outline"
      />
    </View>
  );
}
