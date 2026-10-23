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

export function getAuthErrorMessage(message: string): string {
  if (/network request failed|failed to fetch|fetch failed|networkerror|load failed|timed out|aborted/i.test(message)) {
    return "Could not reach the sign-in service. Check your connection and try again. Your saved data stays on this device.";
  }
  if (message === "Invalid API key") return "Sign-in is unavailable because the authentication configuration is invalid.";
  if (isAuthRateLimitError(message)) return "Too many attempts. Please wait a few minutes before trying again.";
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email before signing in.";
  return message;
}
