import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import * as SecureStore from "expo-secure-store";
import "react-native-reanimated";
import "../global.css";

import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { StealthProvider } from "../context/StealthContext";
import { UserProvider } from "../context/UserContext";
import { ToastProvider } from "../context/ToastContext";
import { ENV } from "../env";
import { Colors } from "../constants/theme";
import { syncService } from "../lib/sync";

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

    let cancelled = false;

    const handleRouting = async () => {
      const inAuthGroup = segments[0] === "(auth)";

      console.log("[AuthGuard] isSignedIn:", isSignedIn, "inAuthGroup:", inAuthGroup, "segments:", segments);

      if (isSignedIn && inAuthGroup) {
        console.log("[AuthGuard] Redirecting signed-in user to (tabs)");
        setTimeout(() => {
          if (!cancelled) {
            router.replace("/(tabs)");
          }
        }, 100);
        return;
      }

      if (!isSignedIn && !inAuthGroup) {
        const online = await syncService.isOnline();
        if (!online) {
          console.log("[AuthGuard] Offline with unknown auth state, keeping current screen");
          return;
        }

        console.log("[AuthGuard] Redirecting unauthenticated user to sign-in");
        setTimeout(() => {
          if (!cancelled) {
            router.replace("/(auth)/sign-in");
          }
        }, 100);
      }
    };

    void handleRouting();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isLoaded, segments, authTimedOut, router]);

  if (!isLoaded && !authTimedOut) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
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
        <StealthProvider>
          <InnerLayout />
        </StealthProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}
