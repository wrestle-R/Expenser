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
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/context/ThemeContext";
import { Colors } from "@/constants/theme";

export default function SignUpScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");

  const handleSignUp = async () => {
    if (!isLoaded) return;

    if (!email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await signUp.create({
        emailAddress: email,
        password,
      });

      // Send email verification
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      console.error("Sign up error:", err);
      Alert.alert(
        "Sign Up Failed",
        err.errors?.[0]?.message || "Please try again"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;

    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      Alert.alert(
        "Verification Failed",
        err.errors?.[0]?.message || "Invalid code"
      );
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
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
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.successBg,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="mail" size={40} color={colors.success} />
            </View>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "bold",
                color: colors.text,
              }}
            >
              Verify Email
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              We've sent a verification code to {email}
            </Text>
          </View>

          <View style={{ gap: 16 }}>
            <View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                Verification Code
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  fontSize: 18,
                  color: colors.text,
                  textAlign: "center",
                  letterSpacing: 8,
                }}
                placeholder="000000"
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: "center",
              }}
              onPress={handleVerify}
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
                  Verify
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
            Sign Up
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: colors.textMuted,
              marginTop: 8,
            }}
          >
            Create your account
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
                placeholder="Create a password"
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

          {/* Confirm Password */}
          <View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: colors.text,
                marginBottom: 8,
              }}
            >
              Confirm Password
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
                placeholder="Confirm your password"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />
            </View>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 8,
            }}
            onPress={handleSignUp}
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
                Sign Up
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign In Link */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginTop: 24,
          }}
        >
          <Text style={{ color: colors.textMuted }}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>
                Sign In
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
