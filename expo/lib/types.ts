// Type definitions matching the Next.js models

export interface ITransaction {
  _id: string;
  userId: string;
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
  reviewStatus: "needs_category" | "active";
  paymentMethod: "bank" | "cash" | "splitwise";
  splitAmount?: number;
  date: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
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
}

export interface IUserProfile {
  _id?: string;
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
  balanceAccounts: {
    paymentMethod: PaymentMethod;
    openingBalance: number;
    openingAt: string | null;
    currentBalance: number;
  }[];
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
export type BottomTabSlot = "transactions" | "workflows" | "analysis" | "empty";

// API Payload types (what we send to the backend)
export interface CreateTransactionPayload {
  type: TransactionType;
  amount: number;
  description?: string;
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
  bankName: string | null;
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
  rawMessage?: string;
  sender?: string | null;
  sourcePackage?: string;
  sourceKey?: string;
  failureReason?: string;
}

export interface BankImportStatus {
  queuedCandidates: number;
  queuedNativeReviews: number;
  localReviews: number;
  retrying: boolean;
}

export type ParsedBankNotificationResponse =
  | {
      kind: "unparsed";
      reason: string;
      parser: "regex" | "groq" | string;
    }
  | {
      kind: "non_transaction";
      reason: string;
      parser: "regex" | "groq" | string;
    }
  | {
      kind: "transaction";
      parsed: {
        bankName: string | null;
        accountSuffix: string | null;
        type: TransactionType;
        amount: number;
        currency: "INR";
        occurredAt: string;
        referenceNumber: string | null;
        payee: string | null;
        availableBalance: number | null;
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

export interface NotificationEnvelope {
  sourceKey: string;
  sender: string | null;
  message: string;
  capturedAt: string;
  sourcePackage: string;
}

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
  userId: string;
  type: TransactionType;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceReconciliationAlert {
  _id: string;
  userId: string;
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
