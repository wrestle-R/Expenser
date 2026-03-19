import "./global.css";
import React from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalHost } from "@rn-primitives/portal";

export default function App() {
  return (
    <SafeAreaProvider>
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-3xl font-bold text-foreground">Welcome</Text>
        <Text className="mt-3 text-center text-base text-muted-foreground">
          Your React Native app is configured and ready.
        </Text>
      </View>
      <PortalHost />
    </SafeAreaProvider>
  );
}