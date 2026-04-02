"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStealthMode } from "@/context/StealthContext";
import { cn } from "@/lib/utils";
import {
  formatMonthKey,
  getExpenseMonthOptions,
  getNetExpenseAnalysis,
  type ExchangeAwareTransaction,
} from "@/lib/transaction-analysis";

interface Transaction extends ExchangeAwareTransaction {
  paymentMethod: "bank" | "cash" | "splitwise";
}

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank: "Bank (UPI)",
  cash: "Cash",
  splitwise: "Splitwise",
};

export default function AnalysisPage() {
  const { isStealthMode } = useStealthMode();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadTransactions() {
      try {
        const res = await fetch("/api/transactions");
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to load transactions");
        }

        const data = await res.json();
        setTransactions(data.transactions);
      } catch (error) {
        console.error("[Analysis] Failed to load transactions:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, []);

  const monthOptions = useMemo(() => getExpenseMonthOptions(transactions), [transactions]);

  useEffect(() => {
    if (!selectedMonth && monthOptions[0]) {
      setSelectedMonth(monthOptions[0]);
    }
  }, [monthOptions, selectedMonth]);

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        transactions
          .filter((transaction) => transaction.type === "expense")
          .map((transaction) => transaction.category || "General")
      )
    ).sort((left, right) => left.localeCompare(right));
  }, [transactions]);

  const paymentMethodOptions = useMemo(() => {
    return Array.from(
      new Set(
        transactions
          .filter((transaction) => transaction.type === "expense")
          .map((transaction) => transaction.paymentMethod)
      )
    );
  }, [transactions]);

  const analysis = useMemo(
    () =>
      getNetExpenseAnalysis(transactions, {
        monthKey: selectedMonth || null,
        paymentMethod:
          selectedPaymentMethod === "all" ? null : selectedPaymentMethod,
        category: selectedCategory === "all" ? null : selectedCategory,
        search,
      }),
    [transactions, selectedMonth, selectedPaymentMethod, selectedCategory, search]
  );

  const numberClassName = cn(
    "transition-all duration-200",
    isStealthMode && "blur-sm select-none"
  );

  let cumulative = 0;
  const slices = analysis.breakdown.map((item, index) => {
    const startRatio =
      analysis.netExpenseTotal === 0 ? 0 : cumulative / analysis.netExpenseTotal;
    cumulative += item.amount;
    const endRatio =
      analysis.netExpenseTotal === 0 ? 0 : cumulative / analysis.netExpenseTotal;

    return {
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length],
      strokeDasharray: `${(endRatio - startRatio) * 100} ${
        100 - (endRatio - startRatio) * 100
      }`,
      strokeDashoffset: `${25 - startRatio * 100}`,
    };
  });

  const shiftMonth = (direction: -1 | 1) => {
    const currentIndex = monthOptions.indexOf(selectedMonth);
    if (currentIndex === -1) {
      return;
    }

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= monthOptions.length) {
      return;
    }

    setSelectedMonth(monthOptions[nextIndex]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analysis</h1>
          <p className="text-muted-foreground">
            Month-by-month expense breakdown after subtracting linked exchange income.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => shiftMonth(1)}
            disabled={monthOptions.indexOf(selectedMonth) <= 0}
          >
            Newer
          </button>
          <div className="min-w-44 rounded-md border px-3 py-2 text-center text-sm font-medium">
            {selectedMonth ? formatMonthKey(selectedMonth) : "No month available"}
          </div>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => shiftMonth(-1)}
            disabled={
              !selectedMonth ||
              monthOptions.indexOf(selectedMonth) === monthOptions.length - 1
            }
          >
            Older
          </button>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="analysis-month">Month</Label>
            <select
              id="analysis-month"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {formatMonthKey(month)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="analysis-payment-method">Payment Method</Label>
            <select
              id="analysis-payment-method"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedPaymentMethod}
              onChange={(event) => setSelectedPaymentMethod(event.target.value)}
            >
              <option value="all">All payment methods</option>
              {paymentMethodOptions.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method] ?? method}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="analysis-category">Category</Label>
            <select
              id="analysis-category"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="all">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="analysis-search">Search</Label>
            <Input
              id="analysis-search"
              placeholder="Filter by description or category"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Net Expense</p>
          <p className="mt-2 text-3xl font-bold">
            ₹
            <span className={numberClassName}>
              {analysis.netExpenseTotal.toLocaleString("en-IN")}
            </span>
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Raw Expense</p>
          <p className="mt-2 text-3xl font-bold">
            ₹
            <span className={numberClassName}>
              {analysis.rawExpenseTotal.toLocaleString("en-IN")}
            </span>
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Recovered via Exchange</p>
          <p className="mt-2 text-3xl font-bold">
            ₹
            <span className={numberClassName}>
              {analysis.recoveredExchangeTotal.toLocaleString("en-IN")}
            </span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {analysis.expenseCount} expense transaction
            {analysis.expenseCount === 1 ? "" : "s"} in view
          </p>
        </Card>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="space-y-3">
            <div className="h-72 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : analysis.breakdown.length === 0 ? (
          <div className="flex min-h-72 items-center justify-center text-center text-muted-foreground">
            No net expenses found for the selected month and filters.
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
            <div className="flex flex-col items-center justify-center gap-4">
              <svg viewBox="0 0 42 42" className="h-72 w-72 -rotate-90">
                <circle
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="transparent"
                  stroke="var(--border)"
                  strokeWidth="5"
                />
                {slices.map((slice) => (
                  <circle
                    key={slice.category}
                    cx="21"
                    cy="21"
                    r="15.9155"
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth="5"
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                  />
                ))}
              </svg>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Filtered Net Expense</p>
                <p className="text-3xl font-bold">
                  ₹
                  <span className={numberClassName}>
                    {analysis.netExpenseTotal.toLocaleString("en-IN")}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {slices.map((slice) => {
                const percentage =
                  analysis.netExpenseTotal === 0
                    ? 0
                    : (slice.amount / analysis.netExpenseTotal) * 100;

                return (
                  <div
                    key={slice.category}
                    className="flex items-center justify-between rounded-xl border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: slice.color }}
                      />
                      <div>
                        <p className="font-medium">{slice.category}</p>
                        <p className="text-sm text-muted-foreground">
                          {percentage.toFixed(1)}% of filtered net spending
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold">
                      ₹
                      <span className={numberClassName}>
                        {slice.amount.toLocaleString("en-IN")}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
