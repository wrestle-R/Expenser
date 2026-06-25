import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { Colors } from "../../constants/theme";
import { api } from "../../lib/api";
import { IUserCategory } from "../../lib/types";
import {
  getBankNotificationAccessEnabled,
  getQueuedBankImports,
  openBankNotificationAccessSettings,
} from "../../lib/bank-imports";

const COLOR_OPTIONS = ["#6b7280", "#f97316", "#3b82f6", "#ec4899", "#22c55e", "#a855f7"];

export default function SetupScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [categories, setCategories] = useState<IUserCategory[]>([]);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setNotificationEnabled(getBankNotificationAccessEnabled());
    setQueuedCount(getQueuedBankImports().length);
    try {
      const nextCategories = await api.getCategories();
      setCategories(nextCategories);
    } catch (error) {
      console.error("[Setup] Failed to load categories:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveCategory = async () => {
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    try {
      await api.saveCategory({ type, name, color });
      setName("");
      await refresh();
    } catch (error) {
      console.error("[Setup] Failed to save category:", error);
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await api.deleteCategory(id);
      await refresh();
    } catch (error) {
      console.error("[Setup] Failed to delete category:", error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>
          Setup
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 2 }}>
          Bank imports and categories
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 16 }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 12,
            borderWidth: 1,
            padding: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons
              name={notificationEnabled ? "checkmark-circle" : "alert-circle"}
              size={22}
              color={notificationEnabled ? colors.success : colors.warning}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                SMS notification access
              </Text>
              <Text style={{ color: colors.textMuted, marginTop: 2 }}>
                {notificationEnabled
                  ? "Enabled for Expenser"
                  : "Enable access to import Union Bank SMS notifications"}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.textMuted, marginTop: 12 }}>
            Queued bank imports: {queuedCount}
          </Text>
          <TouchableOpacity
            onPress={openBankNotificationAccessSettings}
            style={{
              marginTop: 14,
              backgroundColor: colors.primary,
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: "700" }}>
              Open Android Notification Access
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 12,
            borderWidth: 1,
            padding: 16,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
            Categories
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            {(["expense", "income"] as const).map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setType(item)}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  alignItems: "center",
                  backgroundColor: type === item ? colors.primary : colors.backgroundSecondary,
                }}
              >
                <Text
                  style={{
                    color: type === item ? colors.primaryForeground : colors.text,
                    fontWeight: "700",
                    textTransform: "capitalize",
                  }}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="category name"
            placeholderTextColor={colors.textMuted}
            style={{
              marginTop: 12,
              borderColor: colors.border,
              borderRadius: 10,
              borderWidth: 1,
              color: colors.text,
              paddingHorizontal: 12,
              paddingVertical: 12,
            }}
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            {COLOR_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setColor(item)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: item,
                  borderColor: color === item ? colors.text : "transparent",
                  borderWidth: 2,
                }}
              />
            ))}
          </View>
          <TouchableOpacity
            onPress={saveCategory}
            disabled={saving || !name.trim()}
            style={{
              marginTop: 14,
              backgroundColor: colors.primary,
              borderRadius: 10,
              opacity: saving || !name.trim() ? 0.6 : 1,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: "700" }}>
              Add Category
            </Text>
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <View style={{ marginTop: 16, gap: 10 }}>
              {categories
                .filter((category) => category.type === type)
                .map((category) => (
                  <TouchableOpacity
                    key={category._id}
                    onPress={() => deleteCategory(category._id)}
                    style={{
                      alignItems: "center",
                      borderColor: colors.border,
                      borderRadius: 10,
                      borderWidth: 1,
                      flexDirection: "row",
                      gap: 10,
                      padding: 12,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: category.color,
                        borderRadius: 6,
                        height: 12,
                        width: 12,
                      }}
                    />
                    <Text style={{ color: colors.text, flex: 1 }}>{category.name}</Text>
                    <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
