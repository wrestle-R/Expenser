import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "../../components/haptic-tab";
import { Colors } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { useTabPreferences } from "../../context/TabPreferencesContext";
import type { BottomTabSlot } from "../../lib/types";

const configurableTabs: Record<
  Exclude<BottomTabSlot, "empty">,
  { title: string; focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }
> = {
  transactions: {
    title: "Transactions",
    focused: "card",
    unfocused: "card-outline",
  },
  workflows: {
    title: "Workflows",
    focused: "flash",
    unfocused: "flash-outline",
  },
  analysis: {
    title: "Analysis",
    focused: "pie-chart",
    unfocused: "pie-chart-outline",
  },
};

export default function TabLayout() {
  const { isDark } = useTheme();
  const { slots } = useTabPreferences();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const visibleSlots = new Set(slots.filter((slot) => slot !== "empty"));

  const getConfigurableOptions = (name: Exclude<BottomTabSlot, "empty">) => {
    const item = configurableTabs[name];
    return {
      title: item.title,
      href: visibleSlots.has(name) ? undefined : null,
      tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
        <Ionicons
          name={focused ? item.focused : item.unfocused}
          size={24}
          color={color}
        />
      ),
    };
  };

  // Extra padding for gesture navigation
  const bottomPadding = Platform.OS === "android" ? 20 : Math.max(insets.bottom, 20);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: bottomPadding,
          paddingTop: 10,
          height: 70 + bottomPadding,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={getConfigurableOptions("transactions")}
      />
      <Tabs.Screen
        name="workflows"
        options={getConfigurableOptions("workflows")}
      />
      <Tabs.Screen
        name="analysis"
        options={getConfigurableOptions("analysis")}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
