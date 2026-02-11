import React, { useState, useEffect } from "react";
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
import { useRouter } from "expo-router";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/context/ThemeContext";
import { useUserContext } from "@/context/UserContext";
import { Colors, paymentMethodConfig } from "@/constants/theme";
import { clearAllData } from "@/lib/storage";

const paymentOptions = [
  { id: "bank", label: "Bank (UPI)", icon: "card" as const },
  { id: "cash", label: "Cash", icon: "cash" as const },
  { id: "splitwise", label: "Splitwise", icon: "swap-horizontal" as const },
];

export default function ProfileScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const {
    profile,
    loading,
    isOnline,
    pendingCount,
    updateProfile,
    refreshProfile,
  } = useUserContext();

  const [name, setName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setOccupation(profile.occupation || "");
      setSelectedMethods(profile.paymentMethods || []);
    }
  }, [profile]);

  const toggleMethod = (id: string) => {
    setSelectedMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    if (selectedMethods.length === 0) {
      Alert.alert("Error", "Please select at least one payment method");
      return;
    }

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
    } catch (error) {
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await clearAllData();
            await signOut();
          } catch (error) {
            console.error("Sign out error:", error);
          }
        },
      },
    ]);
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* Header */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>
          Profile Settings
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 4 }}>
          Manage your personal information and preferences
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
            {profile?.name?.[0] || user?.firstName?.[0] || "U"}
          </Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: "600", color: colors.text }}>
          {profile?.name || user?.firstName || "User"}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 4 }}>
          {profile?.email || user?.primaryEmailAddress?.emailAddress || ""}
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
        onPress={handleSave}
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
  );
}
