"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useShortcuts, type ShortcutAction } from "@/context/ShortcutContext";
import { cn } from "@/lib/utils";
import { Keyboard, Plus, RotateCcw, Settings, Tag, WalletCards } from "lucide-react";

type Category = {
  _id: string;
  type: "income" | "expense";
  name: string;
  color: string;
};

type BalanceAlert = {
  _id: string;
  expectedBalance: number;
  bankBalance: number;
  difference: number;
  createdAt: string;
};

const SHORTCUT_LABELS: { action: ShortcutAction; label: string }[] = [
  { action: "dashboard", label: "Dashboard" },
  { action: "transactions", label: "Transactions" },
  { action: "workflows", label: "Workflows" },
  { action: "calendar", label: "Calendar" },
  { action: "analysis", label: "Analysis" },
  { action: "setup", label: "Setup" },
  { action: "toggleStealth", label: "Stealth Mode" },
  { action: "toggleTheme", label: "Dark Mode" },
];

export default function SetupPage() {
  const { shortcuts, setShortcut, resetShortcuts } = useShortcuts();
  const [categories, setCategories] = useState<Category[]>([]);
  const [alerts, setAlerts] = useState<BalanceAlert[]>([]);
  const [categoryType, setCategoryType] = useState<"expense" | "income">("expense");
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#6b7280");
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);

  const loadSetupData = useCallback(async () => {
    setLoading(true);
    try {
      const [categoryRes, alertRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/bank-imports/reconcile"),
      ]);
      if (categoryRes.ok) {
        const data = await categoryRes.json();
        setCategories(data.categories ?? []);
      }
      if (alertRes.ok) {
        const data = await alertRes.json();
        setAlerts(data.alerts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSetupData();
  }, [loadSetupData]);

  const groupedCategories = useMemo(() => {
    return {
      expense: categories.filter((category) => category.type === "expense"),
      income: categories.filter((category) => category.type === "income"),
    };
  }, [categories]);

  const saveCategory = async () => {
    if (!categoryName.trim()) {
      return;
    }

    setSavingCategory(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: categoryType,
          name: categoryName,
          color: categoryColor,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save category");
      }

      setCategoryName("");
      await loadSetupData();
    } finally {
      setSavingCategory(false);
    }
  };

  const deleteCategory = async (id: string) => {
    await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
    await loadSetupData();
  };

  const resolveAlert = async (id: string, action: "apply" | "keep") => {
    const res = await fetch("/api/bank-imports/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      await loadSetupData();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="size-6" />
          Setup
        </h1>
        <p className="text-muted-foreground">
          Configure shortcuts, transaction categories, and bank import fixes.
        </p>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Keyboard className="size-5" />
              Keybindings
            </h2>
            <p className="text-sm text-muted-foreground">
              Single-key shortcuts are ignored while typing in inputs.
            </p>
          </div>
          <Button variant="outline" onClick={resetShortcuts}>
            <RotateCcw className="mr-2 size-4" />
            Reset
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUT_LABELS.map((shortcut) => (
            <div key={shortcut.action} className="space-y-1.5">
              <Label>{shortcut.label}</Label>
              <Input
                maxLength={1}
                value={shortcuts[shortcut.action] ?? ""}
                onChange={(event) => setShortcut(shortcut.action, event.target.value)}
                className="h-10 text-center font-mono text-lg"
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Tag className="size-5" />
            Categories
          </h2>
          <p className="text-sm text-muted-foreground">
            These sync to Android and web. SMS imports stay in pending review until category and description are filled.
          </p>
        </div>
        <div className="mb-5 grid gap-3 md:grid-cols-[160px_1fr_120px_auto]">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={categoryType}
            onChange={(event) => setCategoryType(event.target.value as "expense" | "income")}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <Input
            placeholder="category name"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
          />
          <Input
            type="color"
            value={categoryColor}
            onChange={(event) => setCategoryColor(event.target.value)}
          />
          <Button onClick={saveCategory} disabled={savingCategory || !categoryName.trim()}>
            <Plus className="mr-2 size-4" />
            Add
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(["expense", "income"] as const).map((type) => (
            <div key={type} className="rounded-lg border p-3">
              <h3 className="mb-3 font-medium capitalize">{type}</h3>
              <div className="flex flex-wrap gap-2">
                {groupedCategories[type].map((category) => (
                  <button
                    key={category._id}
                    type="button"
                    onClick={() => deleteCategory(category._id)}
                    className="rounded-full border px-3 py-1 text-sm"
                    title="Click to delete"
                  >
                    <span
                      className="mr-2 inline-block size-2 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                  </button>
                ))}
                {!loading && groupedCategories[type].length === 0 && (
                  <span className="text-sm text-muted-foreground">No categories</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <WalletCards className="size-5" />
            Bank Balance Fixes
          </h2>
          <p className="text-sm text-muted-foreground">
            When a bank SMS balance differs from the app balance, choose which one to keep.
          </p>
        </div>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert._id}
              className={cn(
                "flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between",
                alert.difference > 0 ? "border-emerald-500/30" : "border-red-500/30"
              )}
            >
              <div>
                <Badge variant="secondary" className="mb-2">
                  Bank (UPI)
                </Badge>
                <p className="font-medium">
                  Bank says Rs {alert.bankBalance.toFixed(2)}. App expected Rs{" "}
                  {alert.expectedBalance.toFixed(2)}.
                </p>
                <p className="text-sm text-muted-foreground">
                  Difference Rs {alert.difference.toFixed(2)} from{" "}
                  {new Date(alert.createdAt).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => resolveAlert(alert._id, "apply")}>
                  Use Bank Balance
                </Button>
                <Button variant="outline" onClick={() => resolveAlert(alert._id, "keep")}>
                  Keep App Balance
                </Button>
              </div>
            </div>
          ))}
          {!loading && alerts.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending balance fixes.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
