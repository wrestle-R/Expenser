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
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { Colors } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

export default function SignInScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/(tabs)");
        return;
      }
      setLoading(false);
    });
  }, [router]);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter your email and password");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert("Sign In Failed", error.message);
      return;
    }

    router.replace("/(tabs)");
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
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              backgroundColor: colors.primary,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="wallet" size={36} color={colors.primaryForeground} />
          </View>
          <Text style={{ fontSize: 30, fontWeight: "bold", color: colors.text }}>Expenser</Text>
          <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: 8 }}>Sign in to continue</Text>
        </View>

        <View style={{ gap: 16 }}>
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
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
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
              opacity: submitting ? 0.75 : 1,
            }}
            onPress={handleSignIn}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "600" }}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
          <Text style={{ color: colors.textMuted }}>No account? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>Create one</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
