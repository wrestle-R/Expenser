import type { ITransaction } from './types';
export function indexTransactions(transactions: ITransaction[]): { transaction: ITransaction; search: string }[];
export function searchTransactions(index: ReturnType<typeof indexTransactions>, query: string): ITransaction[];
