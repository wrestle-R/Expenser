import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { Colors } from "../../constants/theme";
import { supabase } from "../../lib/supabase";
import {
  AUTH_RATE_LIMIT_COOLDOWN_MS,
  formatCooldown,
  getAuthErrorMessage,
  isAuthRateLimitError,
} from "../../lib/auth-rate-limit";

export default function SignUpScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(0);

  const cooldownRemainingMs = Math.max(0, cooldownUntil - now);
  const cooldownActive = cooldownRemainingMs > 0;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/(tabs)");
        return;
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!cooldownActive) return;

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [cooldownActive]);

  const handleSignUp = async () => {
    if (submitting) return;
    if (cooldownActive) {
      Alert.alert(
        "Please wait",
        `Too many attempts. Try again in ${formatCooldown(cooldownRemainingMs)}.`
      );
      return;
    }

    if (!name.trim() || !email.trim() || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() },
        },
      });

      if (error) {
        if (isAuthRateLimitError(error.message)) {
          setNow(Date.now());
          setCooldownUntil(Date.now() + AUTH_RATE_LIMIT_COOLDOWN_MS);
        }
        setErrorMessage(getAuthErrorMessage(error.message));
        return;
      }
      if (!data.session) {
        Alert.alert(
          "Email confirmation enabled",
          "Check your inbox and confirm your email, then sign in."
        );
        return;
      }

      router.replace("/(tabs)");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error instanceof Error ? error.message : "Sign-in failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, width: "100%", maxWidth: 440, alignSelf: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: colors.primary,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="wallet-outline" size={28} color={colors.primaryForeground} />
          </View>
          <Text style={{ fontSize: 30, fontWeight: "600", letterSpacing: -0.8, color: colors.text }}>Create account</Text>
          <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: 8 }}>Start with email and password</Text>
        </View>

        {errorMessage ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.error, backgroundColor: colors.errorBg, padding: 14, borderRadius: 12, marginBottom: 16, lineHeight: 21 }}>
            {errorMessage}
          </Text>
        ) : null}
        <View style={{ gap: 16 }}>
          <View>
            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 8 }}>Name</Text>
            <TextInput
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 14,
                paddingHorizontal: 16,
                fontSize: 16,
                color: colors.text,
              }}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View>
            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 8 }}>Email</Text>
            <TextInput
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 14,
                paddingHorizontal: 16,
                fontSize: 16,
                color: colors.text,
              }}
              placeholder="you@example.com"
              autoComplete="email"
              accessibilityLabel="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <View>
            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 8 }}>Password</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.backgroundSecondary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 16,
              }}
            >
              <TextInput
                style={{ flex: 1, paddingVertical: 14, fontSize: 16, color: colors.text }}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                accessibilityLabel="Password"
                returnKeyType="go"
                onSubmitEditing={handleSignUp}
              />
              <TouchableOpacity onPress={() => setShowPassword((value) => !value)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 8,
              opacity: submitting || cooldownActive ? 0.75 : 1,
            }}
            onPress={handleSignUp}
            disabled={submitting || cooldownActive}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "600" }}>
                {cooldownActive ? `Try again in ${formatCooldown(cooldownRemainingMs)}` : "Create Account"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
          <Text style={{ color: colors.textMuted }}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
