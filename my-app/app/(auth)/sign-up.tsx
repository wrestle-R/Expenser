import React, { useState, useEffect } from "react";
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
import { useSignUp, useAuth } from "@clerk/clerk-expo";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../context/ThemeContext";
import { Colors } from "../../constants/theme";

export default function SignUpScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const { signUp, setActive, isLoaded } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");

  // Handle navigation when user is signed in
  useEffect(() => {
    if (isSignedIn) {
      console.log("[SignUp] User is signed in, navigating to tabs...");
      router.replace("/(tabs)");
    }
  }, [isSignedIn]);

  const handleSignUp = async () => {
    if (!isLoaded) return;

    if (!username || !email || !password) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      console.log("[SignUp] Creating account...");
      const result = await signUp.create({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        username: username.trim(),
        emailAddress: email.trim(),
      });

      console.log("[SignUp] Result status:", result.status);

      if (result.status === "complete") {
        // Verify at sign-up is OFF — account created directly
        console.log("[SignUp] Account created, setting active session...");
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else if (result.status === "missing_requirements") {
        // Clerk may still require email verification depending on config
        console.log("[SignUp] Missing requirements, checking verifications...");
        const unverifiedEmail = result.unverifiedFields?.includes("email_address");
        if (unverifiedEmail) {
          console.log("[SignUp] Email verification needed, sending code...");
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setPendingVerification(true);
        } else {
          console.log("[SignUp] Unhandled missing requirements:", result.unverifiedFields);
          Alert.alert("Error", "Sign up incomplete. Please try again.");
        }
      } else {
        console.log("[SignUp] Unexpected status:", result.status);
      }
    } catch (err: any) {
      console.error("[SignUp] Error:", err?.errors?.[0]?.message);
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
      console.log("[SignUp] Verifying email code...");
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      console.log("[SignUp] Verification result:", result.status);

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
        console.log("[SignUp] Unexpected verification status:", result.status);
        Alert.alert("Error", "Verification incomplete. Please try again.");
      }
    } catch (err: any) {
      console.error("[SignUp] Verify error:", err?.errors?.[0]?.message);
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
                backgroundColor: colors.primary + "20",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="mail" size={40} color={colors.primary} />
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
              We sent a verification code to {email}
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
                autoFocus
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
              disabled={loading || code.length < 6}
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

            <TouchableOpacity
              style={{ alignItems: "center", padding: 8 }}
              onPress={async () => {
                if (!isLoaded) return;
                try {
                  await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
                  Alert.alert("Sent", "New code sent to " + email);
                } catch (err) {
                  Alert.alert("Error", "Failed to resend code");
                }
              }}
            >
               <Text style={{ color: colors.textMuted, fontWeight: "500" }}>
                Didn't receive a code? <Text style={{ color: colors.primary }}>Resend</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ alignItems: "center", marginTop: 8 }}
              onPress={() => {
                setPendingVerification(false);
                setCode("");
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: "600" }}>
                Back to Sign Up
              </Text>
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
        <View style={{ alignItems: "center", marginBottom: 40 }}>
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
          {/* First & Last Name Row */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                First Name
              </Text>
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
                placeholder="First name"
                placeholderTextColor={colors.textMuted}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                Last Name
              </Text>
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
                placeholder="Last name"
                placeholderTextColor={colors.textMuted}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Username */}
          <View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: colors.text,
                marginBottom: 8,
              }}
            >
              Username <Text style={{ color: colors.textMuted }}>(required)</Text>
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
              <Ionicons name="at" size={20} color={colors.textMuted} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  fontSize: 16,
                  color: colors.text,
                }}
                placeholder="Choose a username"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

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
              Email <Text style={{ color: colors.textMuted }}>(required)</Text>
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
              Password <Text style={{ color: colors.textMuted }}>(required)</Text>
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
            <Text
              style={{
                fontSize: 12,
                color: colors.textMuted,
                marginTop: 4,
              }}
            >
              Minimum 8 characters
            </Text>
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
