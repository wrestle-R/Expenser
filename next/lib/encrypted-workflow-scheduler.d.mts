import type { sql } from "./db";
import type { Cipher } from "./financial-db";
import type { insertEncryptedTransaction } from "./encrypted-transaction-storage.mjs";

export function processEncryptedWorkflows(
  db: typeof sql,
  cipher: Cipher,
  recordTransaction: (db: typeof sql, input: Parameters<typeof insertEncryptedTransaction>[2]) => Promise<unknown>,
  options?: { runUntil?: string; ownerId?: string | null; maxOccurrences?: number },
): Promise<{ processed: number; retrying: number }>;
