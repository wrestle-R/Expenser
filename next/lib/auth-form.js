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
    return "Authentication is misconfigured. Restart the Next app after updating the Supabase public key.";
  }

  const lower = message.toLowerCase();

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
