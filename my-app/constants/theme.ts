/**
 * Theme colors matching the Next.js website
 * Using the same color scheme as the web app
 */

import { Platform } from "react-native";

// Primary colors matching the website
const tintColorLight = "#1a1a2e"; // Primary dark
const tintColorDark = "#e5e5f0"; // Primary light

export const Colors = {
  light: {
    // Base colors
    text: "#1a1a2e",
    textMuted: "#6b6b80",
    background: "#ffffff",
    backgroundSecondary: "#f5f5f7",
    tint: tintColorLight,

    // Card colors
    card: "#ffffff",
    cardForeground: "#1a1a2e",

    // UI elements
    border: "#e5e5ea",
    input: "#e5e5ea",
    icon: "#6b6b80",
    tabIconDefault: "#6b6b80",
    tabIconSelected: tintColorLight,

    // Semantic colors
    primary: "#1a1a2e",
    primaryForeground: "#ffffff",
    secondary: "#f5f5f7",
    secondaryForeground: "#1a1a2e",
    accent: "#1a1a2e",
    accentForeground: "#ffffff",
    destructive: "#ef4444",
    muted: "#f5f5f7",
    mutedForeground: "#6b6b80",

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
    text: "#f5f5f7",
    textMuted: "#a1a1aa",
    background: "#1a1a2e",
    backgroundSecondary: "#252540",
    tint: tintColorDark,

    // Card colors
    card: "#252540",
    cardForeground: "#f5f5f7",

    // UI elements
    border: "rgba(255, 255, 255, 0.1)",
    input: "rgba(255, 255, 255, 0.15)",
    icon: "#a1a1aa",
    tabIconDefault: "#a1a1aa",
    tabIconSelected: tintColorDark,

    // Semantic colors
    primary: "#e5e5f0",
    primaryForeground: "#1a1a2e",
    secondary: "#3a3a50",
    secondaryForeground: "#f5f5f7",
    accent: "#e5e5f0",
    accentForeground: "#1a1a2e",
    destructive: "#f87171",
    muted: "#3a3a50",
    mutedForeground: "#a1a1aa",

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
export const CATEGORIES = [
  { id: "food", label: "Food", color: "#f97316" },
  { id: "transport", label: "Transport", color: "#3b82f6" },
  { id: "shopping", label: "Shopping", color: "#ec4899" },
  { id: "other", label: "Other", color: "#6b7280" },
];

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
