import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/context/ThemeContext";
import { Colors } from "@/constants/theme";

export default function SignInScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!isLoaded) return;

    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      Alert.alert(
        "Sign In Failed",
        err.errors?.[0]?.message || "Please check your credentials and try again"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo/Title */}
        <View style={{ alignItems: "center", marginBottom: 48 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              backgroundColor: colors.primary,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="wallet" size={40} color={colors.primaryForeground} />
          </View>
          <Text
            style={{
              fontSize: 32,
              fontWeight: "bold",
              color: colors.text,
            }}
          >
            Expenser
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: colors.textMuted,
              marginTop: 8,
            }}
          >
            Sign in to continue
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: 16 }}>
          {/* Email */}
          <View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: colors.text,
                marginBottom: 8,
              }}
            >
              Email
            </Text>
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
              <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  fontSize: 16,
                  color: colors.text,
                }}
                placeholder="Enter your email"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password */}
          <View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: colors.text,
                marginBottom: 8,
              }}
            >
              Password
            </Text>
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
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  fontSize: 16,
                  color: colors.text,
                }}
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 8,
            }}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text
                style={{
                  color: colors.primaryForeground,
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Up Link */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginTop: 24,
          }}
        >
          <Text style={{ color: colors.textMuted }}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
