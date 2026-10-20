import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { Colors } from "../constants/theme";
import ResponsiveModal from "./ResponsiveModal";

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "primary" | "destructive" | "success";
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
}

export default function ConfirmModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "primary",
  icon,
  loading = false,
}: ConfirmModalProps) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const getConfirmButtonColor = () => {
    switch (confirmColor) {
      case "destructive":
        return colors.error;
      case "success":
        return colors.success;
      default:
        return colors.primary;
    }
  };

  const getConfirmButtonBg = () => {
    switch (confirmColor) {
      case "destructive":
        return colors.errorBg;
      case "success":
        return colors.successBg;
      default:
        return colors.primary + "15";
    }
  };

  const getIconColor = () => {
    switch (confirmColor) {
      case "destructive":
        return colors.error;
      case "success":
        return colors.success;
      default:
        return colors.primary;
    }
  };

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      loading={loading}
      maxWidth={380}
      contentStyle={styles.modalContent}
    >
      <View style={styles.body}>
              {/* Icon */}
              {icon && (
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: getConfirmButtonBg() },
                  ]}
                >
                  <Ionicons name={icon} size={28} color={getIconColor()} />
                </View>
              )}

              {/* Title */}
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

              {/* Message */}
              <Text style={[styles.message, { color: colors.textMuted }]}>
                {message}
              </Text>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    { borderColor: colors.border },
                  ]}
                  onPress={onClose}
                  disabled={loading}
                >
                  <Text style={[styles.buttonText, { color: colors.text }]}>
                    {cancelText}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.confirmButton,
                    { backgroundColor: getConfirmButtonColor() },
                  ]}
                  onPress={onConfirm}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.buttonText, { color: "#fff" }]}>
                      {confirmText}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
      </View>
    </ResponsiveModal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    alignItems: "center",
  },
  body: {
    width: "100%",
    padding: 24,
    alignItems: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
