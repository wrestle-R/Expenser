import React, { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

interface ResponsiveModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  loading?: boolean;
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
}

export default function ResponsiveModal({
  visible,
  onClose,
  children,
  loading = false,
  maxWidth = 520,
  contentStyle,
}: ResponsiveModalProps) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const horizontalPadding = width < 380 ? 12 : 20;
  const verticalPadding = 12;
  const close = () => {
    if (!loading) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onRequestClose={close}
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Pressable
          accessibilityLabel="Close modal"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? "rgba(0, 0, 0, 0.74)" : "rgba(15, 23, 42, 0.44)" },
          ]}
          onPress={close}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          pointerEvents="box-none"
          style={[
            styles.keyboardArea,
            {
              paddingTop: insets.top + verticalPadding,
              paddingBottom: insets.bottom + verticalPadding,
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                maxHeight: Math.max(240, height - insets.top - insets.bottom - verticalPadding * 2),
                maxWidth,
              },
              contentStyle,
            ]}
          >
            {children}
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardArea: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    elevation: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    width: "100%",
  },
});
