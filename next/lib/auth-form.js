function normalizeValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateSignUpForm({ name, email, password, confirmPassword }) {
  if (!normalizeValue(name) || !normalizeValue(email) || !password || !confirmPassword) {
    return "Please fill in all fields.";
  }

  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }

  return null;
}

function getAuthErrorMessage(message) {
  if (message === "Invalid API key") {
    return "Sign-in is unavailable because the authentication configuration is invalid.";
  }

  const lower = message.toLowerCase();

  if (/network request failed|failed to fetch|fetch failed|networkerror|load failed|timed out|aborted/i.test(message)) {
    return "Could not reach the sign-in service. Check your connection and try again. If this continues, the authentication service may be unavailable.";
  }

  if (isAuthRateLimitError(message)) {
    return "Too many attempts. Please wait a few minutes before trying again.";
  }

  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }

  if (lower.includes("email not confirmed")) {
    return "Please check your email and confirm your account before signing in.";
  }

  return message;
}

function isAuthRateLimitError(message) {
  const lower = message.toLowerCase();
  return (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("too many requests") ||
    lower.includes("too many attempts")
  );
}

exports.validateSignUpForm = validateSignUpForm;
exports.getAuthErrorMessage = getAuthErrorMessage;
exports.isAuthRateLimitError = isAuthRateLimitError;
