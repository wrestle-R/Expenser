import { hasRecentTransactionsWidget, setRecentWidgetTransactions } from "expenser-bank-notifications";
import { paymentMethodConfig } from "../constants/theme";
import { api } from "./api";
import { getOutbox, getStoredStealthMode, getStoredTransactions } from "./storage";
import { mergeServerTransactions } from "./transaction-state.js";
import type { ITransaction } from "./types";
import { formatCurrency, formatDate } from "./utils";

export function publishTransactionWidget(transactions: ITransaction[], ownerId: string | undefined, hidden: boolean) {
  const items = ownerId && !hidden ? transactions.filter((item) => item.userId === ownerId) : [];
  setRecentWidgetTransactions(
    items.map((item) => item.description || item.category || "Transaction"),
    items.map((item) => `${item.type === "income" ? "+" : "−"}₹${formatCurrency(item.amount)}`),
    items.map((item) => `${formatDate(item.date)} · ${paymentMethodConfig[item.paymentMethod]?.label ?? item.paymentMethod}`),
    ownerId,
  );
}

export async function refreshBackgroundTransactionWidget(ownerId: string, accessToken: string) {
  if (!hasRecentTransactionsWidget() || await getStoredStealthMode()) return;

  const serverTransactions = await api.getTransactions(accessToken);
  const [localTransactions, operations, hidden] = await Promise.all([
    getStoredTransactions(),
    getOutbox(),
    getStoredStealthMode(),
  ]);
  publishTransactionWidget(
    mergeServerTransactions({ localTransactions, serverTransactions, operations }),
    ownerId,
    hidden,
  );
}
