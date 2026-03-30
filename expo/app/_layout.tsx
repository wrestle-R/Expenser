import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import * as SecureStore from "expo-secure-store";
import "react-native-reanimated";
import "../global.css";

import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { UserProvider } from "../context/UserContext";
import { ToastProvider } from "../context/ToastContext";
import { ENV } from "../env";
import { Colors } from "../constants/theme";

const AUTH_LOAD_TIMEOUT_MS = 5000;

// Secure token cache for Clerk
const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch {
      return;
    }
  },
};

// Auth guard component
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const hasNavigated = useRef(false);
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setAuthTimedOut(false);
      return;
    }

    const timeout = setTimeout(() => {
      console.warn("[AuthGuard] Auth load timeout, enabling offline fallback mode");
      setAuthTimedOut(true);
    }, AUTH_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || authTimedOut) return;

    const inAuthGroup = segments[0] === "(auth)";

    console.log("[AuthGuard] isSignedIn:", isSignedIn, "inAuthGroup:", inAuthGroup, "segments:", segments);

    if (isSignedIn && inAuthGroup) {
      // Signed in but on auth screen -> go to tabs
      console.log("[AuthGuard] Redirecting signed-in user to (tabs)");
      hasNavigated.current = true;
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 100);
    } else if (!isSignedIn && !inAuthGroup) {
      // Not signed in and not on auth screen -> go to sign-in
      console.log("[AuthGuard] Redirecting unauthenticated user to sign-in");
      hasNavigated.current = true;
      setTimeout(() => {
        router.replace("/(auth)/sign-in");
      }, 100);
    }
  }, [isSignedIn, isLoaded, segments, authTimedOut, router]);

  if (!isLoaded && !authTimedOut) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isLoaded && authTimedOut) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            paddingHorizontal: 16,
            paddingVertical: 16,
            backgroundColor: "#EFF6FF",
            borderWidth: 1,
            borderColor: "#BFDBFE",
            borderRadius: 16,
          }}
        >
          <Text style={{ color: "#1D4ED8", fontWeight: "700", fontSize: 14 }}>
            Sign-in check is taking longer than expected
          </Text>
          <Text style={{ color: "#1E3A8A", marginTop: 8, lineHeight: 20 }}>
            For security, Expenser keeps your cached financial data locked until your session is verified. Please reconnect and try again.
          </Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

// Inner layout that uses theme
function InnerLayout() {
  const { isDark } = useTheme();

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: Colors.dark.primary,
      background: Colors.dark.background,
      card: Colors.dark.card,
      text: Colors.dark.text,
      border: Colors.dark.border,
    },
  };

  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: Colors.light.primary,
      background: Colors.light.background,
      card: Colors.light.card,
      text: Colors.light.text,
      border: Colors.light.border,
    },
  };

  return (
    <NavigationThemeProvider value={isDark ? customDarkTheme : customLightTheme}>
      <UserProvider>
        <ToastProvider>
          <AuthGuard>
            <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen
              name="add-transaction"
              options={{
                presentation: "modal",
                title: "Add Transaction",
                headerStyle: {
                  backgroundColor: isDark ? Colors.dark.card : Colors.light.card,
                },
                headerTintColor: isDark ? Colors.dark.text : Colors.light.text,
              }}
            />
            <Stack.Screen
              name="add-workflow"
              options={{
                presentation: "modal",
                title: "Add Workflow",
                headerStyle: {
                  backgroundColor: isDark ? Colors.dark.card : Colors.light.card,
                },
                headerTintColor: isDark ? Colors.dark.text : Colors.light.text,
              }}
              />
            </Stack>
          </AuthGuard>
        </ToastProvider>
      </UserProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const publishableKey = ENV.CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error("Missing CLERK_PUBLISHABLE_KEY in environment");
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ThemeProvider>
        <InnerLayout />
      </ThemeProvider>
    </ClerkProvider>
  );
}
