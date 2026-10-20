export const AUTH_RATE_LIMIT_COOLDOWN_MS = 3 * 60 * 1000;

export function isAuthRateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("too many requests") ||
    lower.includes("too many attempts")
  );
}

export function formatCooldown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
