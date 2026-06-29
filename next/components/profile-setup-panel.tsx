"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, Plus, RotateCcw, Settings, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShortcuts, type ShortcutAction } from "@/context/ShortcutContext";

type Category = {
  _id: string;
  type: "income" | "expense";
  name: string;
  color: string;
};

const SHORTCUT_LABELS: { action: ShortcutAction; label: string }[] = [
  { action: "dashboard", label: "Dashboard" },
  { action: "transactions", label: "Transactions" },
  { action: "workflows", label: "Workflows" },
  { action: "calendar", label: "Calendar" },
  { action: "analysis", label: "Analysis" },
  { action: "setup", label: "Profile Setup" },
  { action: "toggleStealth", label: "Stealth Mode" },
  { action: "toggleTheme", label: "Dark Mode" },
];

export function ProfileSetupPanel() {
  const { shortcuts, setShortcut, resetShortcuts } = useShortcuts();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryType, setCategoryType] = useState<"expense" | "income">("expense");
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#6b7280");
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

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
      await loadCategories();
    } finally {
      setSavingCategory(false);
    }
  };

  const deleteCategory = async (id: string) => {
    await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
    await loadCategories();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="size-6" />
          Setup
        </h2>
        <p className="text-muted-foreground">
          Configure shortcuts and transaction categories from your profile.
        </p>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Keyboard className="size-5" />
              Keybindings
            </h3>
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
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Tag className="size-5" />
            Categories
          </h3>
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
              <h4 className="mb-3 font-medium capitalize">{type}</h4>
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
    </div>
  );
}
