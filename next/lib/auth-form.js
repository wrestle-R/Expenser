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

  return message;
}

exports.validateSignUpForm = validateSignUpForm;
exports.getAuthErrorMessage = getAuthErrorMessage;
