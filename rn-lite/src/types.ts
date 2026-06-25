export type TransactionType = "income" | "expense";
export type PaymentMethod = "bank" | "cash" | "splitwise";

export interface Transaction {
  _id: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  paymentMethod: PaymentMethod;
  date: string;
  createdAt: string;
  updatedAt: string;
  importSource?: string;
  importSourceKey?: string;
  importedAccountSuffix?: string;
  importedBankBalance?: number;
  importedBankReference?: string;
  importedBankConfidence?: string;
}

export interface UserProfile {
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
}

export interface UserCategory {
  _id: string;
  type: TransactionType;
  name: string;
  color: string;
}

export interface TransactionPayload {
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  paymentMethod: PaymentMethod;
  date?: string;
  importSource?: string;
  importSourceKey?: string;
  importedAccountSuffix?: string;
  importedBankBalance?: number;
  importedBankReference?: string;
  importedBankConfidence?: string;
}

export interface QueuedBankImport {
  bankName: string;
  accountSuffix: string;
  type: TransactionType;
  amount: number;
  occurredAt: string;
  referenceNumber?: string | null;
  payee?: string | null;
  availableBalance: number;
  confidence: string;
  importSource: string;
  importSourceKey: string;
  capturedAt: string;
  notificationPackage?: string;
}

export interface BalanceReconciliationAlert {
  _id: string;
  paymentMethod: PaymentMethod;
  expectedBalance: number;
  bankBalance: number;
  difference: number;
  status: "pending" | "applied" | "kept";
  source: string;
  createdAt: string;
}
