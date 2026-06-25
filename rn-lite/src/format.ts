import type { PaymentMethod, Transaction } from "./types";

export function money(value: number, stealth = false) {
  if (stealth) {
    return "****";
  }
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export function paymentLabel(method: PaymentMethod) {
  if (method === "bank") {
    return "Bank (UPI)";
  }
  if (method === "splitwise") {
    return "Splitwise";
  }
  return "Cash";
}

export function sortTransactions(transactions: Transaction[]) {
  return [...transactions].sort(
    (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
  );
}
