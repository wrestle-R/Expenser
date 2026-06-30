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

export default function SignUpScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const [name, setName] = useState("");
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

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim() },
      },
    });
    setSubmitting(false);

    if (error) {
      Alert.alert("Sign Up Failed", error.message);
      return;
    }
    if (!data.session) {
      Alert.alert(
        "Email confirmation enabled",
        "Disable email confirmation in Supabase for immediate login."
      );
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
          <Text style={{ fontSize: 30, fontWeight: "bold", color: colors.text }}>Create account</Text>
          <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: 8 }}>Start with email and password</Text>
        </View>

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
            onPress={handleSignUp}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "600" }}>Create Account</Text>
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
