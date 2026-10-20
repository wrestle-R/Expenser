import postgres from "postgres";
import { withDefaultPaymentMethod } from "./payment-methods.js";
import { toIsoString, toRequiredIsoString } from "./iso-date.js";

const connectionString =
  process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Missing SUPABASE_DATABASE_URL or DATABASE_URL environment variable."
  );
}

declare global {
  var postgresSql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  global.postgresSql ??
  postgres(connectionString, {
    ssl: "require",
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
  });

if (process.env.NODE_ENV !== "production") {
  global.postgresSql = sql;
}

export type PaymentMethod = "bank" | "cash" | "splitwise";
export type TransactionType = "income" | "expense";
export type TransactionReviewStatus = "needs_category" | "active";

export interface UserRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  occupation: string;
  payment_methods: string[];
  onboarded: boolean;
  dashboard_tutorial_completed: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface BalanceRow {
  user_id: string;
  payment_method: PaymentMethod;
  opening_balance: number | string;
  opening_at: string | Date;
  current_balance: number | string;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  client_request_id: string | null;
  exchange_expense_id: string | null;
  import_source: string | null;
  import_source_key: string | null;
  imported_account_suffix: string | null;
  imported_bank_balance: number | null;
  imported_bank_reference: string | null;
  imported_bank_confidence: string | null;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  review_status: TransactionReviewStatus;
  payment_method: PaymentMethod;
  split_amount: number;
  date: string | Date;
  deleted_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface WorkflowRow {
  id: string;
  user_id: string;
  client_request_id: string | null;
  name: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  payment_method: PaymentMethod;
  split_amount: number;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface UserProfile {
  _id: string;
  userId: string;
  name: string;
  email: string;
  occupation: string;
  paymentMethods: string[];
  balances: {
    bank: number;
    cash: number;
    splitwise: number;
  };
  balanceAccounts: Array<{
    paymentMethod: PaymentMethod;
    openingBalance: number;
    openingAt: string | null;
    currentBalance: number;
  }>;
  onboarded: boolean;
  dashboardTutorialCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserCategoryRow {
  id: string;
  user_id: string;
  type: TransactionType;
  name: string;
  color: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface BalanceReconciliationAlertRow {
  id: string;
  user_id: string;
  transaction_id: string | null;
  payment_method: PaymentMethod;
  expected_balance: number;
  bank_balance: number;
  difference: number;
  status: "pending" | "applied" | "kept";
  source: string;
  created_at: string | Date;
  resolved_at: string | Date | null;
}

export function mapUserRow(row: UserRow, balanceRows: BalanceRow[] = []): UserProfile {
  const accountByMethod = new Map(
    balanceRows.map((balance) => [balance.payment_method, balance])
  );
  const balanceAccounts = (["bank", "cash", "splitwise"] as PaymentMethod[]).map(
    (paymentMethod) => {
      const balance = accountByMethod.get(paymentMethod);
      const rawOpeningAt = balance?.opening_at;
      const openingAtText = rawOpeningAt == null ? "" : String(rawOpeningAt);
      const openingAt =
        !openingAtText || openingAtText.toLowerCase().includes("infinity")
          ? null
          : toIsoString(rawOpeningAt);

      return {
        paymentMethod,
        openingBalance: Number(balance?.opening_balance ?? 0),
        openingAt,
        currentBalance: Number(balance?.current_balance ?? 0),
      };
    }
  );
  const currentBalance = (paymentMethod: PaymentMethod) =>
    balanceAccounts.find((balance) => balance.paymentMethod === paymentMethod)
      ?.currentBalance ?? 0;

  return {
    _id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    occupation: row.occupation,
    paymentMethods: withDefaultPaymentMethod(row.payment_methods),
    balances: {
      bank: currentBalance("bank"),
      cash: currentBalance("cash"),
      splitwise: currentBalance("splitwise"),
    },
    balanceAccounts,
    onboarded: row.onboarded,
    dashboardTutorialCompleted: Boolean(row.dashboard_tutorial_completed),
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at),
  };
}

export function mapTransactionRow(row: TransactionRow) {
  return {
    _id: row.id,
    userId: row.user_id,
    clientRequestId: row.client_request_id ?? undefined,
    exchangeExpenseId: row.exchange_expense_id ?? undefined,
    importSource: row.import_source ?? undefined,
    importSourceKey: row.import_source_key ?? undefined,
    importedAccountSuffix: row.imported_account_suffix ?? undefined,
    importedBankBalance:
      row.imported_bank_balance == null
        ? undefined
        : Number(row.imported_bank_balance),
    importedBankReference: row.imported_bank_reference ?? undefined,
    importedBankConfidence: row.imported_bank_confidence ?? undefined,
    type: row.type,
    amount: Number(row.amount),
    description: row.description,
    category: row.category,
    reviewStatus: row.review_status,
    paymentMethod: row.payment_method,
    splitAmount: Number(row.split_amount ?? 0),
    date: new Date(row.date).toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapUserCategoryRow(row: UserCategoryRow) {
  return {
    _id: row.id,
    userId: row.user_id,
    type: row.type,
    name: row.name,
    color: row.color,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapBalanceReconciliationAlertRow(
  row: BalanceReconciliationAlertRow
) {
  return {
    _id: row.id,
    userId: row.user_id,
    transactionId: row.transaction_id ?? undefined,
    paymentMethod: row.payment_method,
    expectedBalance: Number(row.expected_balance),
    bankBalance: Number(row.bank_balance),
    difference: Number(row.difference),
    status: row.status,
    source: row.source,
    createdAt: new Date(row.created_at).toISOString(),
    resolvedAt: row.resolved_at
      ? new Date(row.resolved_at).toISOString()
      : undefined,
  };
}

export function mapWorkflowRow(row: WorkflowRow) {
  return {
    _id: row.id,
    userId: row.user_id,
    clientRequestId: row.client_request_id ?? undefined,
    name: row.name,
    type: row.type,
    amount: Number(row.amount ?? 0),
    description: row.description,
    category: row.category,
    paymentMethod: row.payment_method,
    splitAmount: Number(row.split_amount ?? 0),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function normalizeDate(value: unknown) {
  if (!value) {
    return new Date();
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function normalizeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function updateBalancesForTransaction(
  balances: UserProfile["balances"],
  transaction: {
    type: TransactionType;
    amount: number;
    paymentMethod: PaymentMethod;
    splitAmount?: number;
  },
  direction: 1 | -1
) {
  const nextBalances = { ...balances };
  const signedAmount =
    transaction.type === "income"
      ? transaction.amount * direction
      : -transaction.amount * direction;

  nextBalances[transaction.paymentMethod] =
    (nextBalances[transaction.paymentMethod] ?? 0) + signedAmount;

  if (
    transaction.type === "expense" &&
    Number(transaction.splitAmount ?? 0) > 0
  ) {
    nextBalances.splitwise =
      (nextBalances.splitwise ?? 0) +
      Number(transaction.splitAmount ?? 0) * direction;
  }

  return nextBalances;
}
