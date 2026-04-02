export interface ExchangeAwareTransaction {
  _id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  paymentMethod?: "bank" | "cash" | "splitwise";
  splitAmount?: number;
  exchangeExpenseId?: string;
  description?: string;
  date?: string;
}

export interface ExpenseOffsetSummary {
  expenseId: string;
  baseAmount: number;
  appliedExchangeAmount: number;
  remainingAmount: number;
}

export function isExchangeTransaction(
  transaction: Pick<ExchangeAwareTransaction, "type" | "category">
) {
  return transaction.type === "income" && transaction.category.toLowerCase() === "exchange";
}

export function getExpenseBaseAmount(
  transaction: Pick<ExchangeAwareTransaction, "type" | "amount" | "splitAmount">
) {
  if (transaction.type !== "expense") {
    return 0;
  }

  return Math.max(0, Number(transaction.amount) - Number(transaction.splitAmount ?? 0));
}

export function getExpenseOffsetSummary(
  transactions: ExchangeAwareTransaction[],
  expenseId: string,
  excludeExchangeId?: string
): ExpenseOffsetSummary | null {
  const expense = transactions.find(
    (transaction) => transaction._id === expenseId && transaction.type === "expense"
  );

  if (!expense) {
    return null;
  }

  const baseAmount = getExpenseBaseAmount(expense);
  const appliedExchangeAmount = transactions.reduce((sum, transaction) => {
    if (
      transaction._id === excludeExchangeId ||
      !isExchangeTransaction(transaction) ||
      transaction.exchangeExpenseId !== expenseId
    ) {
      return sum;
    }

    return sum + Number(transaction.amount);
  }, 0);

  return {
    expenseId,
    baseAmount,
    appliedExchangeAmount,
    remainingAmount: Math.max(0, baseAmount - appliedExchangeAmount),
  };
}

export function getOffsettableExpenses(transactions: ExchangeAwareTransaction[]) {
  return transactions
    .filter((transaction) => transaction.type === "expense")
    .map((transaction) => {
      const summary = getExpenseOffsetSummary(transactions, transaction._id);

      return {
        transaction,
        remainingAmount: summary?.remainingAmount ?? 0,
        baseAmount: summary?.baseAmount ?? 0,
        appliedExchangeAmount: summary?.appliedExchangeAmount ?? 0,
      };
    })
    .filter((item) => item.remainingAmount > 0)
    .sort(
      (left, right) =>
        new Date(right.transaction.date ?? 0).getTime() -
        new Date(left.transaction.date ?? 0).getTime()
    );
}

export function getNetExpenseByCategory(transactions: ExchangeAwareTransaction[]) {
  const expenseById = new Map<string, ExchangeAwareTransaction>();
  const exchangeByExpenseId = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type === "expense") {
      expenseById.set(transaction._id, transaction);
      continue;
    }

    if (isExchangeTransaction(transaction) && transaction.exchangeExpenseId) {
      exchangeByExpenseId.set(
        transaction.exchangeExpenseId,
        (exchangeByExpenseId.get(transaction.exchangeExpenseId) ?? 0) +
          Number(transaction.amount)
      );
    }
  }

  const totals = new Map<string, number>();

  for (const expense of expenseById.values()) {
    const category = expense.category || "General";
    const baseAmount = getExpenseBaseAmount(expense);
    const exchangeAmount = exchangeByExpenseId.get(expense._id) ?? 0;
    const netAmount = Math.max(0, baseAmount - exchangeAmount);

    if (netAmount <= 0) {
      continue;
    }

    totals.set(category, (totals.get(category) ?? 0) + netAmount);
  }

  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);
}

export function getMonthKey(date?: string) {
  if (!date) {
    return "unknown";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthKey(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return "Unknown";
  }

  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function getExpenseMonthOptions(transactions: ExchangeAwareTransaction[]) {
  const monthKeys = Array.from(
    new Set(
      transactions
        .filter((transaction) => transaction.type === "expense")
        .map((transaction) => getMonthKey(transaction.date))
        .filter((monthKey) => monthKey !== "unknown")
    )
  );

  return monthKeys.sort((left, right) => right.localeCompare(left));
}

export interface AnalysisFilters {
  monthKey?: string | null;
  paymentMethod?: string | null;
  category?: string | null;
  search?: string | null;
}

export function getNetExpenseAnalysis(
  transactions: ExchangeAwareTransaction[],
  filters: AnalysisFilters = {}
) {
  const normalizedSearch = filters.search?.trim().toLowerCase() ?? "";

  const filteredExpenses = transactions.filter((transaction) => {
    if (transaction.type !== "expense") {
      return false;
    }

    if (filters.monthKey && getMonthKey(transaction.date) !== filters.monthKey) {
      return false;
    }

    if (filters.paymentMethod && transaction.paymentMethod !== filters.paymentMethod) {
      return false;
    }

    if (
      filters.category &&
      transaction.category.toLowerCase() !== filters.category.toLowerCase()
    ) {
      return false;
    }

    if (
      normalizedSearch &&
      !`${transaction.description ?? ""} ${transaction.category ?? ""}`
        .toLowerCase()
        .includes(normalizedSearch)
    ) {
      return false;
    }

    return true;
  });

  const expenseIds = new Set(filteredExpenses.map((transaction) => transaction._id));
  const exchangeTotalsByExpenseId = new Map<string, number>();

  for (const transaction of transactions) {
    if (
      !isExchangeTransaction(transaction) ||
      !transaction.exchangeExpenseId ||
      !expenseIds.has(transaction.exchangeExpenseId)
    ) {
      continue;
    }

    exchangeTotalsByExpenseId.set(
      transaction.exchangeExpenseId,
      (exchangeTotalsByExpenseId.get(transaction.exchangeExpenseId) ?? 0) +
        Number(transaction.amount)
    );
  }

  const categoryTotals = new Map<string, number>();
  let rawExpenseTotal = 0;
  let recoveredExchangeTotal = 0;

  for (const expense of filteredExpenses) {
    const baseAmount = getExpenseBaseAmount(expense);
    const recoveredAmount = Math.min(
      baseAmount,
      exchangeTotalsByExpenseId.get(expense._id) ?? 0
    );
    const netAmount = Math.max(0, baseAmount - recoveredAmount);

    rawExpenseTotal += baseAmount;
    recoveredExchangeTotal += recoveredAmount;

    if (netAmount <= 0) {
      continue;
    }

    const category = expense.category || "General";
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + netAmount);
  }

  const breakdown = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);

  return {
    breakdown,
    rawExpenseTotal,
    recoveredExchangeTotal,
    netExpenseTotal: Math.max(0, rawExpenseTotal - recoveredExchangeTotal),
    expenseCount: filteredExpenses.length,
  };
}
