// Type definitions matching the Next.js models

export interface ITransaction {
  _id: string;
  clerkId: string;
  clientRequestId?: string;
  exchangeExpenseId?: string;
  importSource?: string;
  importSourceKey?: string;
  importedAccountSuffix?: string;
  importedBankBalance?: number;
  importedBankReference?: string;
  importedBankConfidence?: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  reviewStatus?: "pending" | "complete";
  paymentMethod: "bank" | "cash" | "splitwise";
  splitAmount?: number;
  date: string;
  createdAt: string;
  updatedAt: string;
  // For offline sync
  isLocal?: boolean;
  syncStatus?: "pending" | "synced" | "failed";
  syncError?: string;
}

export interface IWorkflow {
  _id: string;
  userId: string;
  clientRequestId?: string;
  name: string;
  type: "income" | "expense";
  amount?: number;
  description: string;
  category: string;
  paymentMethod: "bank" | "cash" | "splitwise";
  splitAmount?: number;
  createdAt: string;
  updatedAt: string;
  // For offline sync
  isLocal?: boolean;
  syncStatus?: "pending" | "synced" | "failed";
  syncError?: string;
}

export interface IUserProfile {
  _id?: string;
  clerkId: string;
  name: string;
  email: string;
  occupation: string;
  paymentMethods: string[];
  balances: {
    bank: number;
    cash: number;
    splitwise: number;
  };
  onboarded: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ILocalBalance {
  bank: number;
  cash: number;
  splitwise: number;
}

export type PaymentMethod = "bank" | "cash" | "splitwise";
export type TransactionType = "income" | "expense";

// API Payload types (what we send to the backend)
export interface CreateTransactionPayload {
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  paymentMethod: PaymentMethod;
  splitAmount?: number;
  exchangeExpenseId?: string;
  importSource?: string;
  importSourceKey?: string;
  importedAccountSuffix?: string;
  importedBankBalance?: number;
  importedBankReference?: string;
  importedBankConfidence?: string;
  date?: string; // Optional, backend will default to current date
  clientRequestId?: string;
}

export interface BankReviewEvent {
  bankName: string;
  eventType: string;
  amount: number | null;
  accountSuffix: string | null;
  occurredAt: string | null;
  summary: string;
  confidence: "high" | "medium" | "low" | string;
  importSource: string;
  importSourceKey: string;
  capturedAt?: string;
  notificationPackage?: string;
  parser?: "regex" | "groq" | string;
}

export type ParsedBankNotificationResponse =
  | { parsed: null }
  | {
      kind: "transaction";
      parsed: {
        bankName: string;
        accountSuffix: string;
        type: TransactionType;
        amount: number;
        occurredAt: string;
        referenceNumber: string | null;
        payee: string | null;
        availableBalance: number;
        confidence: "high" | "medium" | string;
      };
      importSource: string;
      importSourceKey: string;
      parser: "regex" | "groq" | string;
    }
  | {
      kind: "review_event";
      event: Omit<BankReviewEvent, "importSource" | "importSourceKey" | "parser">;
      importSource: string;
      importSourceKey: string;
      parser: "regex" | "groq" | string;
    };

export interface UpdateTransactionPayload {
  type?: TransactionType;
  amount?: number;
  description?: string;
  category?: string;
  paymentMethod?: PaymentMethod;
  splitAmount?: number;
  exchangeExpenseId?: string;
  importSource?: string;
  importSourceKey?: string;
  importedAccountSuffix?: string;
  importedBankBalance?: number;
  importedBankReference?: string;
  importedBankConfidence?: string;
  date?: string;
}

export interface CreateWorkflowPayload {
  name: string;
  type: TransactionType;
  amount?: number;
  description: string;
  category: string;
  paymentMethod: PaymentMethod;
  splitAmount?: number;
  clientRequestId?: string;
}

// API Response types
export interface TransactionsResponse {
  transactions: ITransaction[];
}

export interface WorkflowsResponse {
  workflows: IWorkflow[];
}

export interface ProfileResponse {
  profile: IUserProfile;
}

export interface IUserCategory {
  _id: string;
  clerkId: string;
  type: TransactionType;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceReconciliationAlert {
  _id: string;
  clerkId: string;
  transactionId?: string;
  paymentMethod: PaymentMethod;
  expectedBalance: number;
  bankBalance: number;
  difference: number;
  status: "pending" | "applied" | "kept";
  source: string;
  createdAt: string;
  resolvedAt?: string;
}
