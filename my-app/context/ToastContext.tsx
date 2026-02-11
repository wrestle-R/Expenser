import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeContext";
import { Colors } from "../constants/theme";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_DURATION = 3000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const animatedValue = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now().toString();
    const newToast: Toast = { id, message, type };

    setToasts((prev) => [...prev.slice(-2), newToast]); // Keep max 3 toasts

    // Auto-remove after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION);
  }, []);

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return "checkmark-circle";
      case "error":
        return "close-circle";
      case "warning":
        return "warning";
      case "info":
      default:
        return "information-circle";
    }
  };

  const getToastColor = (type: ToastType) => {
    switch (type) {
      case "success":
        return colors.success;
      case "error":
        return colors.error;
      case "warning":
        return colors.warning;
      case "info":
      default:
        return colors.info;
    }
  };

  const getToastBg = (type: ToastType) => {
    switch (type) {
      case "success":
        return colors.successBg;
      case "error":
        return colors.errorBg;
      case "warning":
        return colors.warningBg;
      case "info":
      default:
        return colors.infoBg;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View
        style={[
          styles.container,
          { top: insets.top + 10 },
        ]}
        pointerEvents="box-none"
      >
        {toasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            colors={colors}
            icon={getToastIcon(toast.type)}
            iconColor={getToastColor(toast.type)}
            bgColor={getToastBg(toast.type)}
            index={index}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  colors,
  icon,
  iconColor,
  bgColor,
  index,
}: {
  toast: Toast;
  colors: any;
  icon: string;
  iconColor: string;
  bgColor: string;
  index: number;
}) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Enter animation
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Exit animation
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, TOAST_DURATION - 300);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: colors.card,
          borderColor: iconColor,
          borderLeftWidth: 4,
          transform: [{ translateY }],
          opacity,
          marginTop: index > 0 ? 8 : 0,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: bgColor },
        ]}
      >
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    width: width - 32,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
});

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
