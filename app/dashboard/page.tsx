"use client";

import React, { useEffect, useState } from "react";
import { useUserContext } from "@/context/UserContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  PiggyBank,
  ArrowRightLeft,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Plus,
} from "lucide-react";
import Link from "next/link";

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

export default function DashboardPage() {
  const { profile, loading } = useUserContext();
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(true);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const res = await fetch("/api/transactions");
        if (res.ok) {
          const data = await res.json();
          setRecentTransactions(data.transactions.slice(0, 5));
          console.log("[Dashboard] Fetched", data.transactions.length, "transactions");
        }
      } catch (err) {
        console.error("[Dashboard] Error fetching transactions:", err);
      } finally {
        setLoadingTxns(false);
      }
    }
    fetchTransactions();
  }, []);

  if (loading || !profile) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const totalBalance =
    (profile.paymentMethods.includes("bank") ? profile.balances.bank : 0) +
    (profile.paymentMethods.includes("cash") ? profile.balances.cash : 0) +
    (profile.paymentMethods.includes("splitwise") ? profile.balances.splitwise : 0);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {profile.name.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s your financial overview
          </p>
        </div>
        <Button render={<Link href="/dashboard/transactions?new=true" />} nativeButton={false}>
            <Plus className="size-4 mr-1" />
            Add Transaction
        </Button>
      </div>

      {/* Total Balance Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">
              Total Balance
            </p>
            <p className="text-4xl font-bold mt-1 flex items-center gap-1">
              <IndianRupee className="size-8" />
              {totalBalance.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              Across {profile.paymentMethods.length} method
              {profile.paymentMethods.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </Card>

      {/* Balance Cards - only show selected methods */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {profile.paymentMethods.map((method) => {
          const config = methodConfig[method as keyof typeof methodConfig];
          const balance = profile.balances[method as keyof typeof profile.balances] || 0;
          return (
            <Card key={method} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`rounded-lg p-2.5 ${config.bg}`}>
                  <config.icon className={`size-5 ${config.color}`} />
                </div>
                <span className="font-medium">{config.label}</span>
              </div>
              <p className="text-2xl font-bold flex items-center gap-0.5">
                <IndianRupee className="size-5" />
                {balance.toLocaleString("en-IN")}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Transactions</h2>
          <Button variant="ghost" size="sm" render={<Link href="/dashboard/transactions" />} nativeButton={false}>View All</Button>
        </div>
        <Card>
          {loadingTxns ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <p>No transactions yet.</p>
              <Button className="mt-3" size="sm" render={<Link href="/dashboard/transactions?new=true" />} nativeButton={false}>
                  Add your first transaction
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {recentTransactions.map((txn) => {
                const config = methodConfig[txn.paymentMethod];
                return (
                  <div
                    key={txn._id}
                    className="flex items-center justify-between p-4"
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
                        <p className="text-xs text-muted-foreground">
                          {config.label} &middot;{" "}
                          {new Date(txn.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
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
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
