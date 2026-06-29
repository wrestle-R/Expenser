"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChartPie,
  CircleDollarSign,
  Search,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

type BalanceHistoryItem = {
  _id: string;
  expectedBalance: number;
  bankBalance: number;
  difference: number;
  status: "pending" | "applied" | "kept";
  createdAt: string;
};

type BalanceStats = {
  totalCount: number;
  pendingCount: number;
  appliedCount: number;
  keptCount: number;
  totalAbsoluteDifference: number;
  latestDifference: number;
  latestCreatedAt: string | null;
};

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
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryItem[]>([]);
  const [balanceStats, setBalanceStats] = useState<BalanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadAnalysisData() {
      try {
        const [transactionRes, reconciliationRes] = await Promise.all([
          fetch("/api/transactions"),
          fetch("/api/bank-imports/reconcile?includeHistory=true"),
        ]);

        if (!transactionRes.ok) {
          const data = await transactionRes.json().catch(() => null);
          throw new Error(data?.error || "Failed to load transactions");
        }

        const transactionData = await transactionRes.json();
        setTransactions(transactionData.transactions ?? []);

        if (reconciliationRes.ok) {
          const reconciliationData = await reconciliationRes.json();
          setBalanceHistory(reconciliationData.history ?? []);
          setBalanceStats(reconciliationData.stats ?? null);
        }
      } catch (error) {
        console.error("[Analysis] Failed to load transactions:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAnalysisData();
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
  const topCategory = analysis.breakdown[0];
  const averageNetExpense =
    analysis.expenseCount === 0
      ? 0
      : analysis.netExpenseTotal / analysis.expenseCount;
  const visibleBalanceHistory = balanceHistory.slice(0, 5);

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

  const formatMoney = (value: number) => value.toLocaleString("en-IN");
  const formatSignedMoney = (value: number) =>
    `${value >= 0 ? "+" : "-"}₹${formatMoney(Math.abs(value))}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="w-fit gap-1.5">
            <ChartPie className="size-3.5" />
            Expense Intelligence
          </Badge>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analysis</h1>
            <p className="text-muted-foreground">
              Clean monthly spending, exchange recovery, and bank balance drift.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-card p-1 shadow-sm">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            onClick={() => shiftMonth(1)}
            disabled={monthOptions.indexOf(selectedMonth) <= 0}
          >
            Newer
          </button>
          <div className="min-w-44 rounded-lg bg-muted px-3 py-2 text-center text-sm font-semibold">
            {selectedMonth ? formatMonthKey(selectedMonth) : "No month available"}
          </div>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
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

      <Card className="p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.4fr]">
          <div className="space-y-2">
            <Label htmlFor="analysis-month">Month</Label>
            <select
              id="analysis-month"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            >
              {monthOptions.length === 0 && <option value="">No months</option>}
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
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
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
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
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
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="analysis-search"
                placeholder="Filter description or category"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Net Expense</p>
            <CircleDollarSign className="size-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight">
            ₹<span className={numberClassName}>{formatMoney(analysis.netExpenseTotal)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">After exchange recovery</p>
        </Card>

        <Card className="p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Raw Expense</p>
            <ArrowDownRight className="size-5 text-red-500" />
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight">
            ₹<span className={numberClassName}>{formatMoney(analysis.rawExpenseTotal)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {analysis.expenseCount} transaction{analysis.expenseCount === 1 ? "" : "s"} in view
          </p>
        </Card>

        <Card className="p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Recovered</p>
            <ArrowUpRight className="size-5 text-emerald-500" />
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight">
            ₹
            <span className={numberClassName}>
              {formatMoney(analysis.recoveredExchangeTotal)}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Linked exchange income</p>
        </Card>

        <Card className="p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Avg Net</p>
            <CalendarClock className="size-5 text-violet-500" />
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight">
            ₹
            <span className={numberClassName}>
              {formatMoney(Math.round(averageNetExpense))}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {topCategory ? `Top: ${topCategory.category}` : "No category yet"}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Category Mix</h2>
              <p className="text-sm text-muted-foreground">
                Net spend after subtracting linked exchange income.
              </p>
            </div>
            <Badge variant="outline">{analysis.breakdown.length} categories</Badge>
          </div>
          {loading ? (
            <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
              <div className="h-60 animate-pulse rounded-full bg-muted" />
              <div className="space-y-3">
                <div className="h-16 animate-pulse rounded-xl bg-muted" />
                <div className="h-16 animate-pulse rounded-xl bg-muted" />
                <div className="h-16 animate-pulse rounded-xl bg-muted" />
              </div>
            </div>
          ) : analysis.breakdown.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed text-center text-muted-foreground">
              No net expenses found for the selected month and filters.
            </div>
          ) : (
            <div className="grid gap-7 lg:grid-cols-[260px_1fr]">
              <div className="flex flex-col items-center justify-center gap-4">
                <svg viewBox="0 0 42 42" className="h-60 w-60 -rotate-90">
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
                  <p className="text-sm text-muted-foreground">Filtered Net</p>
                  <p className="text-3xl font-bold">
                    ₹<span className={numberClassName}>{formatMoney(analysis.netExpenseTotal)}</span>
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
                    <div key={slice.category} className="rounded-xl border p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: slice.color }}
                          />
                          <p className="truncate font-medium">{slice.category}</p>
                        </div>
                        <p className="shrink-0 font-semibold">
                          ₹<span className={numberClassName}>{formatMoney(slice.amount)}</span>
                        </p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: slice.color,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {percentage.toFixed(1)}% of filtered net spending
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <WalletCards className="size-5" />
                Bank Balance Changes
              </h2>
              <p className="text-sm text-muted-foreground">
                Every time SMS balance differed from app balance.
              </p>
            </div>
            <Badge variant={balanceStats?.pendingCount ? "default" : "secondary"}>
              {balanceStats?.pendingCount ?? 0} pending
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Changes</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {balanceStats?.totalCount ?? 0}
              </p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Total Drift</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                ₹
                <span className={numberClassName}>
                  {formatMoney(balanceStats?.totalAbsoluteDifference ?? 0)}
                </span>
              </p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Latest</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                <span className={numberClassName}>
                  {formatSignedMoney(balanceStats?.latestDifference ?? 0)}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {visibleBalanceHistory.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between gap-4 rounded-xl border p-3"
              >
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant={item.status === "pending" ? "default" : "secondary"}>
                      {item.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    App ₹
                    <span className={numberClassName}>
                      {formatMoney(item.expectedBalance)}
                    </span>{" "}
                    / Bank ₹
                    <span className={numberClassName}>
                      {formatMoney(item.bankBalance)}
                    </span>
                  </p>
                </div>
                <p
                  className={cn(
                    "shrink-0 font-semibold tabular-nums",
                    item.difference >= 0 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  <span className={numberClassName}>
                    {formatSignedMoney(item.difference)}
                  </span>
                </p>
              </div>
            ))}

            {!loading && visibleBalanceHistory.length === 0 && (
              <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                No bank balance changes tracked yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
