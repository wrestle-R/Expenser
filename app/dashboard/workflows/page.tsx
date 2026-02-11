"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useUserContext } from "@/context/UserContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  CreditCard,
  PiggyBank,
  ArrowRightLeft,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Workflow,
  Zap,
  ShoppingBag,
  Utensils,
  Car,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const methodConfig = {
  bank: {
    label: "Bank (UPI)",
    icon: CreditCard,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  cash: {
    label: "Cash",
    icon: PiggyBank,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  splitwise: {
    label: "Splitwise",
    icon: ArrowRightLeft,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
};

const MAIN_CATEGORIES = [
  { id: "food", label: "Food", icon: Utensils, color: "text-orange-600" },
  { id: "transport", label: "Transport", icon: Car, color: "text-blue-600" },
  { id: "shopping", label: "Shopping", icon: ShoppingBag, color: "text-pink-600" },
  { id: "other", label: "Other", icon: MoreHorizontal, color: "text-gray-600" },
];

interface IWorkflow {
  _id: string;
  userId: string;
  name: string;
  type: "income" | "expense";
  amount?: number;
  description: string;
  category: string;
  paymentMethod: "bank" | "cash" | "splitwise";
  splitAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function WorkflowsPage() {
  const { profile } = useUserContext();
  const [workflows, setWorkflows] = useState<IWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Workflow form
  const [workflowName, setWorkflowName] = useState("");
  const [newType, setNewType] = useState<"income" | "expense">("expense");
  const [newAmount, setNewAmount] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [newMethod, setNewMethod] = useState("");
  const [isSplit, setIsSplit] = useState(false);
  const [splitAmount, setSplitAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.workflows);
        console.log("[Workflows] Fetched", data.workflows.length, "workflows");
      }
    } catch (err) {
      console.error("[Workflows] Error fetching:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    if (profile?.paymentMethods.length && !newMethod) {
      setNewMethod(profile.paymentMethods[0]);
    }
  }, [profile, newMethod]);

  const resetForm = () => {
    setWorkflowName("");
    setNewType("expense");
    setNewAmount("");
    setNewDescription("");
    setNewCategory("");
    setCustomCategory("");
    setNewMethod("");
    setIsSplit(false);
    setSplitAmount("");
  };

  const handleSaveWorkflow = async () => {
    if (!workflowName || !newDescription || !newMethod) return;
    setSaving(true);

    const finalCategory = newCategory === "other" && customCategory ? customCategory : newCategory;

    const workflowData = {
      name: workflowName,
      type: newType,
      amount: newAmount ? Number(newAmount) : 0,
      description: newDescription,
      category: finalCategory || "General",
      paymentMethod: newMethod,
      splitAmount: isSplit ? Number(splitAmount) : 0,
    };

    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workflowData),
      });

      if (res.ok) {
        console.log("[Workflows] Workflow saved successfully");
        resetForm();
        setDialogOpen(false);
        await fetchWorkflows();
      }
    } catch (err) {
      console.error("[Workflows] Error saving workflow:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        console.log("[Workflows] Workflow deleted successfully");
        await fetchWorkflows();
      }
    } catch (err) {
      console.error("[Workflows] Error deleting workflow:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">
            Create and manage transaction templates
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button onClick={resetForm}>
                <Plus className="size-4 mr-1" />
                Create Workflow
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Workflow</DialogTitle>
              <DialogDescription>
                Save a transaction template for quick reuse.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Workflow Name</Label>
                <Input
                  placeholder="e.g., Daily Rickshaw, Lunch"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                />
              </div>

              {/* Type toggle */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setNewType("expense")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all",
                    newType === "expense" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"
                  )}
                >
                  <TrendingDown className="size-4 text-red-500" />
                  Expense
                </button>
                <button
                  onClick={() => setNewType("income")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all",
                    newType === "income" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"
                  )}
                >
                  <TrendingUp className="size-4 text-green-500" />
                  Income
                </button>
              </div>

              <div className="space-y-2">
                <Label>Amount (Optional)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="0.00"
                    type="number"
                    className="pl-9"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="What is this for?"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <div className="grid grid-cols-2 gap-2">
                  {MAIN_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setNewCategory(cat.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm transition-all",
                          newCategory === cat.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <Icon className={`size-4 ${cat.color}`} />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
                {newCategory === "other" && (
                  <Input
                    placeholder="Enter custom category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="flex gap-2 flex-wrap">
                  {profile?.paymentMethods.map((method) => {
                    const config = methodConfig[method as keyof typeof methodConfig];
                    const Icon = config.icon;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setNewMethod(method)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-all",
                          newMethod === method
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <Icon className={`size-4 ${config.color}`} />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {newType === "expense" && (
                <div className="pt-3 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <ArrowRightLeft className="size-4 text-orange-500" />
                      Split transaction?
                    </Label>
                    <Switch checked={isSplit} onCheckedChange={setIsSplit} />
                  </div>

                  {isSplit && (
                    <div className="bg-orange-500/5 p-3 rounded-lg space-y-3 border border-orange-200/20">
                      <p className="text-xs text-muted-foreground">
                        Set split amount (Optional)
                      </p>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Owed back amount</Label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-2.5 size-4 text-orange-500" />
                          <Input
                            className="pl-9 border-orange-200/30"
                            placeholder="0.00"
                            type="number"
                            value={splitAmount}
                            onChange={(e) => setSplitAmount(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleSaveWorkflow}
                disabled={!workflowName || !newDescription || !newMethod || saving}
              >
                {saving ? "Saving..." : "Save Workflow"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Workflows list */}
      <Card>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Workflow className="size-16 mx-auto opacity-20 mb-4" />
            <p className="text-lg font-medium">No workflows yet</p>
            <p className="text-sm mt-1">
              Create templates for frequently used transactions.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {workflows.map((wf) => {
              const config = methodConfig[wf.paymentMethod as keyof typeof methodConfig];
              const Icon = config?.icon || CreditCard;
              return (
                <div
                  key={wf._id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2.5 bg-primary/10">
                      <Zap className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{wf.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs">
                          <Icon className="size-3 mr-1" />
                          {config?.label || wf.paymentMethod}
                        </Badge>
                        {wf.amount && wf.amount > 0 && (
                          <Badge variant="outline" className="text-xs">
                            ₹{wf.amount}
                          </Badge>
                        )}
                        {wf.splitAmount && wf.splitAmount > 0 && (
                          <Badge variant="outline" className="text-xs text-orange-500">
                            Split ₹{wf.splitAmount}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {wf.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {wf.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleDeleteWorkflow(wf._id)}
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
