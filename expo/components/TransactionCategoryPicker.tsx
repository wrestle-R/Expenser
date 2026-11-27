import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { api } from "../lib/api";
import type { IUserCategory, TransactionType } from "../lib/types";

const EXPENSE_CATEGORIES = [
  { id: "food", label: "Food", icon: "restaurant-outline" as const, color: "#f97316" },
  { id: "transport", label: "Transport", icon: "car-outline" as const, color: "#3b82f6" },
  { id: "shopping", label: "Shopping", icon: "bag-handle-outline" as const, color: "#ec4899" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal-circle-outline" as const, color: "#6b7280" },
];

const INCOME_CATEGORIES = [
  { id: "salary", label: "Salary", icon: "briefcase-outline" as const, color: "#10b981" },
  { id: "gift", label: "Gift", icon: "gift-outline" as const, color: "#a855f7" },
  { id: "exchange", label: "Exchange", icon: "swap-horizontal-outline" as const, color: "#0ea5e9" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal-circle-outline" as const, color: "#6b7280" },
];

const categoryIcons = new Map<string, keyof typeof Ionicons.glyphMap>([
  ["bills", "receipt-outline"],
  ["college", "school-outline"],
  ["family", "people-outline"],
  ["fitness", "barbell-outline"],
  ["travel", "airplane-outline"],
]);

type CategoryOption = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

function getCategoriesForType(
  type: TransactionType,
  userCategories: IUserCategory[],
  selectedCategory: string
): CategoryOption[] {
  const builtIns = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const builtInIds = new Set(builtIns.map((category) => category.id.toLowerCase()));
  const customCategories = userCategories
    .filter((category) => category.type === type && !builtInIds.has(category.name.toLowerCase()))
    .map((category) => ({
      id: category.name,
      label: category.name.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()),
      icon: categoryIcons.get(category.name.toLowerCase()) ?? "pricetag-outline",
      color: category.color,
    }));
  const options = [...builtIns, ...customCategories];

  if (
    selectedCategory.trim() &&
    !options.some((category) => category.id.toLowerCase() === selectedCategory.toLowerCase())
  ) {
    options.push({
      id: selectedCategory,
      label: selectedCategory,
      icon: "pricetag-outline",
      color: "#6b7280",
    });
  }

  return options;
}

interface TransactionCategoryPickerProps {
  ownerId?: string;
  type: TransactionType;
  value: string;
  onChange: (value: string) => void;
  allowExchange?: boolean;
}

export default function TransactionCategoryPicker({ ownerId, type, value, onChange, allowExchange = false }: TransactionCategoryPickerProps) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const [saved, setSaved] = useState<{ ownerId: string; categories: IUserCategory[] }>();
  const { fontScale, width } = useWindowDimensions();
  const categoryWidth = width < 340 || fontScale >= 1.5 ? "100%" : "47%";
  const scopedCategories = saved && saved.ownerId === ownerId ? saved.categories : [];
  const options = getCategoriesForType(type, scopedCategories, value)
    .filter((option) => allowExchange || option.id !== "exchange");

  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    void api.getCategories().then((categories) => {
      if (active) setSaved({ ownerId, categories });
    }).catch(() => {});
    return () => { active = false; };
  }, [ownerId]);

  return (
    <View style={{ marginBottom: 16, gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textMuted }}>Category</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((category) => {
          const selected = value.toLowerCase() === category.id.toLowerCase();
          return (
            <TouchableOpacity key={category.id} accessibilityRole="button"
              accessibilityState={{ selected }} onPress={() => onChange(category.id)}
              style={{
                flexBasis: categoryWidth, flexGrow: 1, minHeight: 44,
                flexDirection: "row", alignItems: "center", gap: 8,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
                backgroundColor: selected ? category.color + "18" : colors.card,
                borderWidth: 1, borderColor: selected ? category.color : colors.border,
              }}>
              <Ionicons name={category.icon} size={17} color={category.color} />
              <Text style={{ flexShrink: 1, color: colors.text, fontSize: 14 }}>{category.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
