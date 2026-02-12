// Type definitions matching the Next.js models

export interface ITransaction {
  _id: string;
  clerkId: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  paymentMethod: "bank" | "cash" | "splitwise";
  splitAmount?: number;
  date: string;
  createdAt: string;
  updatedAt: string;
  // For offline sync
  isLocal?: boolean;
  syncStatus?: "pending" | "synced" | "failed";
}

export interface IWorkflow {
  _id: string;
  userId: string;
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
  date?: string; // Optional, backend will default to current date
}

export interface CreateWorkflowPayload {
  name: string;
  type: TransactionType;
  amount?: number;
  description: string;
  category: string;
  paymentMethod: PaymentMethod;
  splitAmount?: number;
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
