export function fetchTransactionHistory<T>(fetcher?: typeof fetch): Promise<{ transactions: T[] }>;
