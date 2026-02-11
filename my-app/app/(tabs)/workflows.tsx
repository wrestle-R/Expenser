import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/context/ThemeContext";
import { useUserContext } from "@/context/UserContext";
import { Colors, paymentMethodConfig } from "@/constants/theme";
import { formatCurrency } from "@/lib/utils";
import { IWorkflow } from "@/lib/types";

export default function WorkflowsScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const {
    workflows,
    loading,
    refreshWorkflows,
    deleteWorkflow,
  } = useUserContext();

  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshWorkflows();
    setRefreshing(false);
  };

  const handleWorkflowPress = (workflow: IWorkflow) => {
    router.push({
      pathname: "/add-transaction",
      params: {
        workflowId: workflow._id,
        type: workflow.type,
        amount: workflow.amount?.toString() || "",
        description: workflow.description,
        category: workflow.category,
        paymentMethod: workflow.paymentMethod,
        splitAmount: workflow.splitAmount?.toString() || "0",
      },
    });
  };

  const handleDelete = async (workflow: IWorkflow) => {
    Alert.alert(
      "Delete Workflow",
      `Are you sure you want to delete "${workflow.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(workflow._id);
            try {
              await deleteWorkflow(workflow._id);
            } catch (error) {
              Alert.alert("Error", "Failed to delete workflow");
            } finally {
              setDeleting(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 16,
          paddingTop: 8,
        }}
      >
        <View>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>
            Workflows
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 2 }}>
            Quick actions for recurring transactions
          </Text>
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
            flexDirection: "row",
            alignItems: "center",
          }}
          onPress={() => router.push("/add-workflow")}
        >
          <Ionicons name="add" size={18} color={colors.primaryForeground} />
          <Text
            style={{
              color: colors.primaryForeground,
              fontWeight: "600",
              marginLeft: 4,
            }}
          >
            Add
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {workflows.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 32,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="flash-outline" size={48} color={colors.textMuted} />
            <Text
              style={{
                color: colors.textMuted,
                marginTop: 16,
                fontSize: 16,
                textAlign: "center",
              }}
            >
              No workflows yet
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                marginTop: 8,
                fontSize: 14,
                textAlign: "center",
              }}
            >
              Create workflows for quick recurring transactions
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 10,
                marginTop: 16,
              }}
              onPress={() => router.push("/add-workflow")}
            >
              <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>
                Create your first workflow
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {workflows.map((workflow) => {
              const methodConfig =
                paymentMethodConfig[workflow.paymentMethod];
              const methodColor = isDark
                ? methodConfig?.darkColor
                : methodConfig?.lightColor;
              const methodBg = isDark
                ? methodConfig?.darkBg
                : methodConfig?.lightBg;

              return (
                <TouchableOpacity
                  key={workflow._id}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  onPress={() => handleWorkflowPress(workflow)}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor:
                              workflow.type === "income"
                                ? colors.successBg
                                : colors.errorBg,
                            borderRadius: 8,
                            padding: 8,
                          }}
                        >
                          <Ionicons
                            name="flash"
                            size={16}
                            color={
                              workflow.type === "income"
                                ? colors.success
                                : colors.error
                            }
                          />
                        </View>
                        <Text
                          style={{
                            marginLeft: 10,
                            fontWeight: "600",
                            fontSize: 16,
                            color: colors.text,
                          }}
                        >
                          {workflow.name}
                        </Text>
                      </View>

                      <Text
                        style={{
                          color: colors.textMuted,
                          marginBottom: 8,
                        }}
                        numberOfLines={2}
                      >
                        {workflow.description}
                      </Text>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: methodBg,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                          }}
                        >
                          <Ionicons
                            name={
                              workflow.paymentMethod === "bank"
                                ? "card"
                                : workflow.paymentMethod === "cash"
                                ? "cash"
                                : "swap-horizontal"
                            }
                            size={12}
                            color={methodColor}
                          />
                          <Text
                            style={{
                              marginLeft: 4,
                              fontSize: 12,
                              color: methodColor,
                              fontWeight: "500",
                            }}
                          >
                            {methodConfig?.label}
                          </Text>
                        </View>

                        <View
                          style={{
                            backgroundColor: colors.backgroundSecondary,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              color: colors.textMuted,
                            }}
                          >
                            {workflow.category}
                          </Text>
                        </View>

                        {workflow.splitAmount && workflow.splitAmount > 0 && (
                          <View
                            style={{
                              backgroundColor: colors.splitwiseBg,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                color: colors.splitwise,
                              }}
                            >
                              Split: ₹{formatCurrency(workflow.splitAmount)}
                            </Text>
                          </View>
                        )}

                        {workflow.isLocal && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              backgroundColor: colors.warningBg,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 6,
                            }}
                          >
                            <Ionicons
                              name="cloud-upload-outline"
                              size={12}
                              color={colors.warning}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                color: colors.warning,
                                marginLeft: 4,
                              }}
                            >
                              Pending
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      {workflow.amount && workflow.amount > 0 && (
                        <Text
                          style={{
                            fontWeight: "700",
                            fontSize: 18,
                            color:
                              workflow.type === "income"
                                ? colors.success
                                : colors.error,
                            marginBottom: 8,
                          }}
                        >
                          {workflow.type === "income" ? "+" : "-"}₹
                          {formatCurrency(workflow.amount)}
                        </Text>
                      )}
                      <TouchableOpacity
                        style={{ padding: 8 }}
                        onPress={() => handleDelete(workflow)}
                        disabled={deleting === workflow._id}
                      >
                        {deleting === workflow._id ? (
                          <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color={colors.error}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 12,
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Ionicons
                      name="arrow-forward-circle"
                      size={16}
                      color={colors.primary}
                    />
                    <Text
                      style={{
                        marginLeft: 8,
                        color: colors.primary,
                        fontWeight: "500",
                      }}
                    >
                      Tap to use this workflow
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
