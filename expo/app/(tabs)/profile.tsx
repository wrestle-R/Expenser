import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../context/ThemeContext";
import { useUserContext } from "../../context/UserContext";
import { Colors, paymentMethodConfig } from "../../constants/theme";
import { clearAllData, getStoredBankReviewEvents } from "../../lib/storage";
import ConfirmModal from "../../components/ConfirmModal";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { IUserCategory } from "../../lib/types";
import {
  getBankNotificationAccessHealth,
  getQueuedNativeBankReviewEvents,
  getQueuedBankImports,
  getQueuedRawBankImportCandidates,
  openBankNotificationAccessSettings,
  type NativeNotificationAccessHealth,
} from "../../lib/bank-imports";

const paymentOptions = [
  { id: "bank", label: "Bank (UPI)", icon: "card" as const },
  { id: "cash", label: "Cash", icon: "cash" as const },
  { id: "splitwise", label: "Splitwise", icon: "swap-horizontal" as const },
];
const COLOR_OPTIONS = ["#6b7280", "#f97316", "#3b82f6", "#ec4899", "#22c55e", "#a855f7"];
const EMPTY_ACCESS_HEALTH: NativeNotificationAccessHealth = {
  settingEnabled: false,
  recentReadCount: 0,
  lastReadAt: null,
  hasRecentReads: false,
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
  const insets = useSafeAreaInsets();
  const {
    profile,
    loading,
    isOnline,
    pendingCount,
    updateProfile,
  } = useUserContext();

  const [name, setName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [accessHealth, setAccessHealth] = useState<NativeNotificationAccessHealth>(EMPTY_ACCESS_HEALTH);
  const [queuedCount, setQueuedCount] = useState(0);
  const [rawCandidateCount, setRawCandidateCount] = useState(0);
  const [reviewEventCount, setReviewEventCount] = useState(0);
  const [categories, setCategories] = useState<IUserCategory[]>([]);
  const [categoryType, setCategoryType] = useState<"expense" | "income">("expense");
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState(COLOR_OPTIONS[0]);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setOccupation(profile.occupation || "");
      setSelectedMethods(profile.paymentMethods || []);
    }
  }, [profile]);

  const refreshSetup = useCallback(async () => {
    setAccessHealth(getBankNotificationAccessHealth());
    setQueuedCount(getQueuedBankImports().length);
    setRawCandidateCount(getQueuedRawBankImportCandidates().length);
    try {
      const storedReviewEvents = await getStoredBankReviewEvents();
      setReviewEventCount(
        getQueuedNativeBankReviewEvents().length + storedReviewEvents.length
      );
      const nextCategories = await api.getCategories();
      setCategories(nextCategories);
    } catch (error) {
      console.error("[Profile] Failed to load setup data:", error);
    } finally {
      setCategoryLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSetup();
  }, [refreshSetup]);

  const toggleMethod = (id: string) => {
    setSelectedMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSavePress = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    if (selectedMethods.length === 0) {
      Alert.alert("Error", "Please select at least one payment method");
      return;
    }

    setShowSaveConfirm(true);
  };

  const handleConfirmSave = async () => {
    setShowSaveConfirm(false);
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        occupation: occupation.trim(),
        paymentMethods: selectedMethods,
        onboarded: true,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSaving(false);
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

  const saveCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert("Error", "Please enter a category name");
      return;
    }

    setCategorySaving(true);
    try {
      await api.saveCategory({
        type: categoryType,
        name: categoryName.trim(),
        color: categoryColor,
      });
      setCategoryName("");
      await refreshSetup();
    } catch (error) {
      console.error("[Profile] Failed to save category:", error);
      Alert.alert("Error", "Failed to save category");
    } finally {
      setCategorySaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await api.deleteCategory(id);
      await refreshSetup();
    } catch (error) {
      console.error("[Profile] Failed to delete category:", error);
      Alert.alert("Error", "Failed to delete category");
    }
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
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>
            Profile
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>
            Manage your personal information, imports, and categories
          </Text>
        </View>

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
              Offline {pendingCount > 0 && `(${pendingCount} pending)`}
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

      {/* Save Button */}
      <TouchableOpacity
        style={{
          backgroundColor: saved ? colors.success : colors.primary,
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: "center",
          marginBottom: 16,
        }}
        onPress={handleSavePress}
        disabled={saving || saved}
      >
        {saving ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {saved && (
              <Ionicons
                name="checkmark"
                size={20}
                color={colors.primaryForeground}
                style={{ marginRight: 8 }}
              />
            )}
            <Text
              style={{
                color: colors.primaryForeground,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              {saved ? "Saved!" : "Save Changes"}
            </Text>
          </View>
        )}
      </TouchableOpacity>

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
          Notification access: {accessHealth.hasRecentReads ? "working" : "Permission has not been given"}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Android setting: {accessHealth.settingEnabled ? "enabled" : "not enabled"}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Notifications read in last 4 hours: {accessHealth.recentReadCount}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Last notification read: {formatLastRead(accessHealth.lastReadAt)}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Queued imports: {queuedCount}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Raw Union Bank retries: {rawCandidateCount}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Bank events needing review: {reviewEventCount}
        </Text>
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

      {/* Categories */}
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
          Categories
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {(["expense", "income"] as const).map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setCategoryType(item)}
              style={{
                flex: 1,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: "center",
                backgroundColor:
                  categoryType === item ? colors.primary : colors.backgroundSecondary,
              }}
            >
              <Text
                style={{
                  color:
                    categoryType === item
                      ? colors.primaryForeground
                      : colors.text,
                  fontWeight: "700",
                  textTransform: "capitalize",
                }}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          value={categoryName}
          onChangeText={setCategoryName}
          placeholder="category name"
          placeholderTextColor={colors.textMuted}
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
        />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {COLOR_OPTIONS.map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setCategoryColor(item)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: item,
                borderColor: categoryColor === item ? colors.text : "transparent",
                borderWidth: 2,
              }}
            />
          ))}
        </View>
        <TouchableOpacity
          onPress={saveCategory}
          disabled={categorySaving || !categoryName.trim()}
          style={{
            marginTop: 14,
            backgroundColor: colors.primary,
            borderRadius: 12,
            opacity: categorySaving || !categoryName.trim() ? 0.6 : 1,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>
            Add Category
          </Text>
        </TouchableOpacity>
        {categoryLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <View style={{ marginTop: 16, gap: 10 }}>
            {categories
              .filter((category) => category.type === categoryType)
              .map((category) => (
                <TouchableOpacity
                  key={category._id}
                  onPress={() => deleteCategory(category._id)}
                  style={{
                    alignItems: "center",
                    borderColor: colors.border,
                    borderRadius: 10,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 10,
                    padding: 12,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: category.color,
                      borderRadius: 6,
                      height: 12,
                      width: 12,
                    }}
                  />
                  <Text style={{ color: colors.text, flex: 1 }}>{category.name}</Text>
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
          </View>
        )}
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

      {/* Save Confirmation Modal */}
      <ConfirmModal
        visible={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onConfirm={handleConfirmSave}
        title="Save Changes"
        message="Are you sure you want to save these profile changes?"
        confirmText="Save"
        cancelText="Cancel"
        confirmColor="success"
        icon="save-outline"
        loading={saving}
      />

      {/* Sign Out Confirmation Modal */}
      <ConfirmModal
        visible={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={handleConfirmSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out? Any unsynced data will be lost."
        confirmText="Sign Out"
        cancelText="Cancel"
        confirmColor="destructive"
        icon="log-out-outline"
      />
    </View>
  );
}
