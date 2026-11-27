import { sql } from "./db";
import { loadFinancialCipher } from "./financial-encryption.mjs";
import { assertEncryptedStorageReady, hydrateFinancialRows, lockFinancialOwner, markEncryptedWriter } from "./financial-records.mjs";

export type Cipher = ReturnType<typeof loadFinancialCipher>;
let cipher: Cipher | undefined;

export function financialCipher() {
  return cipher ??= loadFinancialCipher();
}

export async function financialWrite<T>(ownerId: string, work: (db: typeof sql, key: Cipher) => Promise<T>) {
  const key = financialCipher();
  return sql.begin(async (tx) => {
    await assertEncryptedStorageReady(tx);
    await markEncryptedWriter(tx);
    await lockFinancialOwner(tx, ownerId);
    return work(tx as unknown as typeof sql, key);
  }) as Promise<T>;
}

export type FinancialKind = "transactions" | "balances" | "balance_reconciliation_alerts" | "user_categories" | "workflows" | "users";

export async function hydrate<T extends { user_id: string }>(
  db: typeof sql, key: Cipher, kind: FinancialKind, ownerId: string, rows: T[],
): Promise<T[]> {
  return hydrateFinancialRows(db, key, kind, ownerId, rows) as Promise<T[]>;
}

export async function financialRead<T>(work: (db: typeof sql, key: Cipher) => Promise<T>) {
  const key = financialCipher();
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    await assertEncryptedStorageReady(tx);
    return work(tx as unknown as typeof sql, key);
  }) as Promise<T>;
}
