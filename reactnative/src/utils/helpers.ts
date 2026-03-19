/** Format currency in Indian locale */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN');
}

/** Short date display: "12 Mar" */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

/** Full date: "12 Mar 2025" */
export function formatFullDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Generate a unique temporary ID for local-first items */
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
