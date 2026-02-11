import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useUserContext } from "@/context/UserContext";

export default function TabLayout() {
  const { isDark } = useTheme();
  const { isOnline, pendingCount } = useUserContext();
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: 8,
          paddingTop: 6,
          height: 60,
        },
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: "600",
        },
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerTitle: "Expenser",
          headerRight: () =>
            !isOnline ? (
              <View
                style={{
                  marginRight: 16,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons name="cloud-offline" size={20} color={colors.warning} />
              </View>
            ) : pendingCount > 0 ? (
              <View
                style={{
                  marginRight: 16,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons name="sync" size={20} color={colors.info} />
              </View>
            ) : null,
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
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "card" : "card-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="workflows"
        options={{
          title: "Workflows",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "flash" : "flash-outline"}
              size={24}
              color={color}
            />
          ),
        }}
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
