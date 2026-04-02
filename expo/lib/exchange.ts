import { ITransaction } from "./types";

export function isExchangeTransaction(
  transaction: Pick<ITransaction, "type" | "category">
) {
  return transaction.type === "income" && transaction.category.toLowerCase() === "exchange";
}

export function getExpenseBaseAmount(
  transaction: Pick<ITransaction, "type" | "amount" | "splitAmount">
) {
  if (transaction.type !== "expense") {
    return 0;
  }

  return Math.max(0, Number(transaction.amount) - Number(transaction.splitAmount ?? 0));
}

export function getExpenseOffsetSummary(
  transactions: ITransaction[],
  expenseId: string,
  excludeExchangeId?: string
) {
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
    expense,
    baseAmount,
    appliedExchangeAmount,
    remainingAmount: Math.max(0, baseAmount - appliedExchangeAmount),
  };
}

export function getSelectableExchangeExpenses(transactions: ITransaction[]) {
  return transactions
    .filter((transaction) => transaction.type === "expense" && !transaction.isLocal)
    .map((transaction) => {
      const summary = getExpenseOffsetSummary(transactions, transaction._id);

      return {
        transaction,
        remainingAmount: summary?.remainingAmount ?? 0,
      };
    })
    .filter((item) => item.remainingAmount > 0)
    .sort(
      (left, right) =>
        new Date(right.transaction.date).getTime() -
        new Date(left.transaction.date).getTime()
    );
}
