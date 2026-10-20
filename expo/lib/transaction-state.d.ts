import type { ITransaction } from "./types";
import type { OutboxOperation } from "./storage";

export function dedupeTransactions(items: ITransaction[]): ITransaction[];
export function optimisticAddTransaction(
  items: ITransaction[],
  transaction: ITransaction
): ITransaction[];
export function optimisticUpdateTransaction(
  items: ITransaction[],
  id: string,
  patch: Partial<ITransaction>
): ITransaction[];
export function optimisticDeleteTransaction(
  items: ITransaction[],
  id: string
): ITransaction[];
export function mergeServerTransactions(input: {
  localTransactions: ITransaction[];
  serverTransactions: ITransaction[];
  operations: Pick<OutboxOperation, "entity" | "entityId" | "action">[];
}): ITransaction[];
