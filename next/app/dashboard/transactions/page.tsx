"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useUserContext } from "@/context/UserContext";
import { useSearchParams } from "next/navigation";
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
  ShoppingBag,
  Utensils,
  Car,
  MoreHorizontal,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  _id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  paymentMethod: "bank" | "cash" | "splitwise";
  splitAmount?: number;
  date: string;
}

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

export default function TransactionsPage() {
  const { profile, refreshProfile } = useUserContext();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [workflows, setWorkflows] = useState<IWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New transaction form
  const [newType, setNewType] = useState<"income" | "expense">("expense");
  const [newAmount, setNewAmount] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [newMethod, setNewMethod] = useState("");
  const [isSplit, setIsSplit] = useState(false);
  const [splitAmount, setSplitAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions");
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        console.log("[Transactions] Fetched", data.transactions.length, "transactions");
      }
    } catch (err) {
      console.error("[Transactions] Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.workflows);
        console.log("[Transactions] Fetched", data.workflows.length, "workflows");
      }
    } catch (err) {
      console.error("[Transactions] Error fetching workflows:", err);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchWorkflows();
  }, [fetchTransactions, fetchWorkflows]);

  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setDialogOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (profile?.paymentMethods.length && !newMethod) {
      setNewMethod(profile.paymentMethods[0]);
    }
  }, [profile, newMethod]);

  const resetForm = () => {
    setNewAmount("");
    setNewDescription("");
    setNewCategory("");
    setCustomCategory(""); 
    setIsSplit(false);
    setSplitAmount("");
  };

  const applyWorkflow = (workflow: IWorkflow) => {
    setNewType(workflow.type);
    setNewAmount(workflow.amount ? workflow.amount.toString() : "");
    setNewDescription(workflow.description);
    
    const mainCategoryIds = MAIN_CATEGORIES.map(c => c.id);
    if (mainCategoryIds.includes(workflow.category.toLowerCase())) {
      setNewCategory(workflow.category.toLowerCase());
      setCustomCategory("");
    } else {
      setNewCategory("other");
      setCustomCategory(workflow.category);
    }
    
    setNewMethod(workflow.paymentMethod);
    if (workflow.splitAmount && workflow.splitAmount > 0) {
      setIsSplit(true);
      setSplitAmount(workflow.splitAmount.toString());
    } else {
      setIsSplit(false);
      setSplitAmount("");
    }
  };

  const handleAddTransaction = async () => {
    if (!newAmount || !newDescription || !newMethod) return;
    
    // Validate split amount
    if (isSplit && Number(splitAmount) >= Number(newAmount)) {
      alert("Split amount must be less than total amount");
      return;
    }

    setSaving(true);
    const finalCategory = newCategory === "other" && customCategory ? customCategory : newCategory;
    
    const payload = {
      type: newType,
      amount: Number(newAmount),
      description: newDescription,
      category: finalCategory || "General",
      paymentMethod: newMethod,
      splitAmount: isSplit ? Number(splitAmount) : 0,
    };

    console.log("[Transactions] Adding transaction:", payload);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        console.log("[Transactions] Transaction added successfully");
        resetForm();
        setDialogOpen(false);
        await fetchTransactions();
        await refreshProfile();
      }
    } catch (err) {
      console.error("[Transactions] Error adding:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      console.log("[Transactions] Deleting transaction:", id);
      const res = await fetch(`/api/transactions?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        console.log("[Transactions] Deleted successfully");
        await fetchTransactions();
        await refreshProfile();
      }
    } catch (err) {
      console.error("[Transactions] Error deleting:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage all your transactions
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button onClick={resetForm}>
                <Plus className="size-4 mr-1" />
                Add Transaction
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
              <DialogDescription>
                Record a new income or expense transaction.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 pt-2">
              {/* Quick Workflows */}
              {workflows.length > 0 && (
                <div className="pb-3 border-b">
                  <Label className="text-xs text-muted-foreground mb-2 block">Quick Select from Workflows</Label>
                  <div className="flex gap-2 flex-wrap">
                    {workflows.slice(0, 3).map((wf) => (
                      <button
                        key={wf._id}
                        type="button"
                        onClick={() => applyWorkflow(wf)}
                        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all hover:border-primary hover:bg-primary/5"
                      >
                        <Zap className="size-3 text-primary" />
                        {wf.name}
                      </button>
                    ))}
                    {workflows.length > 3 && (
                      <a
                        href="/dashboard/workflows"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        +{workflows.length - 3} more
                      </a>
                    )}
                  </div>
                </div>
              )}

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
                <Label>Amount</Label>
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
                  placeholder="What was this for?"
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
                        You paid <span className="font-bold">₹{newAmount || "0"}</span> total.
                        How much is owed back to you?
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Owed to you</Label>
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
                        <div className="space-y-1.5">
                          <Label className="text-xs">Net expense</Label>
                          <div className="h-10 px-3 flex items-center font-bold text-sm bg-background/50 rounded-md border">
                            ₹{(Number(newAmount || 0) - Number(splitAmount || 0)).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleAddTransaction}
                disabled={!newAmount || !newDescription || !newMethod || saving}
              >
                {saving ? "Adding..." : "Add Transaction"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transactions list */}
      <Card>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-lg">No transactions yet</p>
            <p className="text-sm mt-1">
              Click &quot;Add Transaction&quot; to get started.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {transactions.map((txn) => {
              const config = methodConfig[txn.paymentMethod as keyof typeof methodConfig] || methodConfig.bank;
              return (
                <div
                  key={txn._id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-lg p-2 ${
                        txn.type === "income"
                          ? "bg-emerald-500/10"
                          : "bg-red-500/10"
                      }`}
                    >
                      {txn.type === "income" ? (
                        <TrendingUp className="size-4 text-emerald-500" />
                      ) : (
                        <TrendingDown className="size-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {txn.description}
                        {(txn.splitAmount || 0) > 0 && (
                           <span className="ml-2 inline-flex items-center rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-500 ring-1 ring-inset ring-orange-500/20">
                             Split
                           </span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs">
                          {config.label}
                        </Badge>
                        {txn.category !== "General" && (
                          <Badge variant="outline" className="text-xs">
                            {txn.category}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(txn.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p
                          className={`font-semibold flex items-center justify-end gap-0.5 ${
                            txn.type === "income"
                              ? "text-emerald-500"
                              : "text-red-500"
                          }`}
                        >
                          {txn.type === "income" ? "+" : "-"}
                          <IndianRupee className="size-3.5" />
                          {txn.amount.toLocaleString("en-IN")}
                        </p>
                        {(txn.splitAmount || 0) > 0 && (
                            <p className="text-[10px] text-orange-500 flex items-center justify-end gap-1">
                                <ArrowRightLeft className="size-2.5" />
                                Gets back ₹{txn.splitAmount}
                            </p>
                        )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(txn._id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
