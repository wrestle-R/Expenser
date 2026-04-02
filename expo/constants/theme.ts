/**
 * Theme colors matching the Next.js website
 * Using the same color scheme as the web app
 */

import { Platform } from "react-native";

// Neutral palette aligned with the website theme variables
const tintColorLight = "#666666";
const tintColorDark = "#d1d1d1";

export const Colors = {
  light: {
    // Base colors
    text: "#434343",
    textMuted: "#737373",
    background: "#f4f4f5",
    backgroundSecondary: "#ececec",
    tint: tintColorLight,

    // Card colors
    card: "#fafafa",
    cardForeground: "#434343",

    // UI elements
    border: "#dadada",
    input: "#e7e7e7",
    icon: "#737373",
    tabIconDefault: "#737373",
    tabIconSelected: tintColorLight,

    // Semantic colors
    primary: "#666666",
    primaryForeground: "#ffffff",
    secondary: "#e7e7e7",
    secondaryForeground: "#434343",
    accent: "#cecece",
    accentForeground: "#ffffff",
    destructive: "#ef4444",
    muted: "#ececec",
    mutedForeground: "#737373",

    // Status colors
    success: "#22c55e",
    successBg: "rgba(34, 197, 94, 0.1)",
    error: "#ef4444",
    errorBg: "rgba(239, 68, 68, 0.1)",
    warning: "#f59e0b",
    warningBg: "rgba(245, 158, 11, 0.1)",
    info: "#3b82f6",
    infoBg: "rgba(59, 130, 246, 0.1)",

    // Payment method colors
    bank: "#3b82f6",
    bankBg: "rgba(59, 130, 246, 0.1)",
    cash: "#22c55e",
    cashBg: "rgba(34, 197, 94, 0.1)",
    splitwise: "#f97316",
    splitwiseBg: "rgba(249, 115, 22, 0.1)",
  },
  dark: {
    // Base colors
    text: "#ebebeb",
    textMuted: "#adadad",
    background: "#292929",
    backgroundSecondary: "#333333",
    tint: tintColorDark,

    // Card colors
    card: "#303030",
    cardForeground: "#ebebeb",

    // UI elements
    border: "#4a4a4a",
    input: "#454545",
    icon: "#adadad",
    tabIconDefault: "#adadad",
    tabIconSelected: tintColorDark,

    // Semantic colors
    primary: "#d1d1d1",
    primaryForeground: "#292929",
    secondary: "#3f3f3f",
    secondaryForeground: "#ebebeb",
    accent: "#555555",
    accentForeground: "#ebebeb",
    destructive: "#f87171",
    muted: "#3a3a3a",
    mutedForeground: "#adadad",

    // Status colors
    success: "#4ade80",
    successBg: "rgba(74, 222, 128, 0.15)",
    error: "#f87171",
    errorBg: "rgba(248, 113, 113, 0.15)",
    warning: "#fbbf24",
    warningBg: "rgba(251, 191, 36, 0.15)",
    info: "#60a5fa",
    infoBg: "rgba(96, 165, 250, 0.15)",

    // Payment method colors
    bank: "#60a5fa",
    bankBg: "rgba(96, 165, 250, 0.15)",
    cash: "#4ade80",
    cashBg: "rgba(74, 222, 128, 0.15)",
    splitwise: "#fb923c",
    splitwiseBg: "rgba(251, 146, 60, 0.15)",
  },
};

// Payment method configuration
export const paymentMethodConfig = {
  bank: {
    label: "Bank (UPI)",
    lightColor: Colors.light.bank,
    darkColor: Colors.dark.bank,
    lightBg: Colors.light.bankBg,
    darkBg: Colors.dark.bankBg,
  },
  cash: {
    label: "Cash",
    lightColor: Colors.light.cash,
    darkColor: Colors.dark.cash,
    lightBg: Colors.light.cashBg,
    darkBg: Colors.dark.cashBg,
  },
  splitwise: {
    label: "Splitwise",
    lightColor: Colors.light.splitwise,
    darkColor: Colors.dark.splitwise,
    lightBg: Colors.light.splitwiseBg,
    darkBg: Colors.dark.splitwiseBg,
  },
};

// Categories configuration
export const EXPENSE_CATEGORIES = [
  { id: "food", label: "Food", color: "#f97316" },
  { id: "transport", label: "Transport", color: "#3b82f6" },
  { id: "shopping", label: "Shopping", color: "#ec4899" },
  { id: "other", label: "Other", color: "#6b7280" },
];

export const INCOME_CATEGORIES = [
  { id: "salary", label: "Salary", color: "#22c55e" },
  { id: "gift", label: "Gift", color: "#a855f7" },
  { id: "exchange", label: "Exchange", color: "#0ea5e9" },
  { id: "other", label: "Other", color: "#6b7280" },
];

// Backward-compatible alias for existing screens.
export const CATEGORIES = EXPENSE_CATEGORIES;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
