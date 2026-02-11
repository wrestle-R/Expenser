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
import {
  CreditCard,
  PiggyBank,
  ArrowRightLeft,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
} from "lucide-react";

interface Transaction {
  _id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  paymentMethod: "bank" | "cash" | "splitwise";
  date: string;
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

export default function TransactionsPage() {
  const { profile, refreshProfile } = useUserContext();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New transaction form
  const [newType, setNewType] = useState<"income" | "expense">("expense");
  const [newAmount, setNewAmount] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newMethod, setNewMethod] = useState("");
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

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

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

  const handleAddTransaction = async () => {
    if (!newAmount || !newDescription || !newMethod) return;
    setSaving(true);
    console.log("[Transactions] Adding transaction:", {
      type: newType,
      amount: Number(newAmount),
      description: newDescription,
      category: newCategory || "General",
      paymentMethod: newMethod,
    });

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          amount: Number(newAmount),
          description: newDescription,
          category: newCategory || "General",
          paymentMethod: newMethod,
        }),
      });

      if (res.ok) {
        console.log("[Transactions] Transaction added successfully");
        setNewAmount("");
        setNewDescription("");
        setNewCategory("");
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
              <Button>
                <Plus className="size-4 mr-1" />
                Add Transaction
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Transaction</DialogTitle>
              <DialogDescription>
                Log a new income or expense transaction.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Type toggle */}
              <div className="flex gap-2">
                <Button
                  variant={newType === "expense" ? "default" : "outline"}
                  onClick={() => setNewType("expense")}
                  className="flex-1"
                  size="sm"
                >
                  <TrendingDown className="size-4 mr-1" />
                  Expense
                </Button>
                <Button
                  variant={newType === "income" ? "default" : "outline"}
                  onClick={() => setNewType("income")}
                  className="flex-1"
                  size="sm"
                >
                  <TrendingUp className="size-4 mr-1" />
                  Income
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0"
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
                <Label>
                  Category{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  placeholder="e.g., Food, Transport, Rent"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="flex gap-2 flex-wrap">
                  {profile?.paymentMethods.map((method) => {
                    const config =
                      methodConfig[method as keyof typeof methodConfig];
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setNewMethod(method)}
                        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-all cursor-pointer ${
                          newMethod === method
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <config.icon
                          className={`size-4 ${config.color}`}
                        />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

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
              const config = methodConfig[txn.paymentMethod];
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
                    <p
                      className={`font-semibold flex items-center gap-0.5 ${
                        txn.type === "income"
                          ? "text-emerald-500"
                          : "text-red-500"
                      }`}
                    >
                      {txn.type === "income" ? "+" : "-"}
                      <IndianRupee className="size-3.5" />
                      {txn.amount.toLocaleString("en-IN")}
                    </p>
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
