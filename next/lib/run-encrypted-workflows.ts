import { sql } from "./db";
import { financialCipher } from "./financial-db";
import { processEncryptedWorkflows } from "./encrypted-workflow-scheduler.mjs";
import { insertEncryptedTransaction } from "./encrypted-transaction-storage.mjs";

export function runEncryptedWorkflows(ownerId: string | null = null) {
  const key = financialCipher();
  return processEncryptedWorkflows(
    sql, key, (tx: typeof sql, input: Parameters<typeof insertEncryptedTransaction>[2]) =>
      insertEncryptedTransaction(tx, key, input),
    { ownerId, maxOccurrences: ownerId ? 20 : 50 },
  );
}
