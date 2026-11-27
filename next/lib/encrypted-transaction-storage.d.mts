import type { sql, BalanceRow, PaymentMethod, TransactionRow } from "./db";
import type { Cipher } from "./financial-db";

type TransactionFields = Pick<TransactionRow, "amount" | "type" | "description" | "category" | "payment_method" | "split_amount"> & Partial<TransactionRow>;

export function ensureEncryptedBalances(db: typeof sql, cipher: Cipher, ownerId: string): Promise<void>;
export function readEncryptedBalances(db: typeof sql, cipher: Cipher, ownerId: string): Promise<BalanceRow[]>;
export function rebaseEncryptedBalance(db: typeof sql, cipher: Cipher, ownerId: string, method: PaymentMethod, amount: number, at?: string | null): Promise<void>;
export function refreshEncryptedBalances(db: typeof sql, cipher: Cipher, ownerId: string): Promise<void>;
export function insertEncryptedTransaction(db: typeof sql, cipher: Cipher, input: {
  ownerId: string;
  transactionId: string;
  date: Date | string;
  reviewStatus?: TransactionRow["review_status"];
  exchangeExpenseId?: string | null;
  fields: TransactionFields;
}): Promise<TransactionRow>;
