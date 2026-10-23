export function parseTransactionPage(params: URLSearchParams): { limit: number; cursor: { date: string; createdAt: string; id: string } | null } | null;
export function transactionPageCursor(row: { cursor_date: string; cursor_created_at: string; id: string }): string;
