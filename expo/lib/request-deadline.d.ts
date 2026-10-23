export function withRequestDeadline<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs?: number): Promise<T>;
