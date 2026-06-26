const DATABASE_CONNECTION_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);

const DATABASE_CONNECTION_MESSAGES = [
  "tenant/user",
  "getaddrinfo",
  "connection terminated",
  "connection timeout",
  "password authentication failed",
];

function isDatabaseConnectionError(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  if (DATABASE_CONNECTION_CODES.has(code)) {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error?.message === "string"
        ? error.message
        : "";

  const normalized = message.toLowerCase();
  return DATABASE_CONNECTION_MESSAGES.some((pattern) =>
    normalized.includes(pattern)
  );
}

function getApiErrorResponse(error, fallbackMessage) {
  if (isDatabaseConnectionError(error)) {
    return {
      body: {
        error: "Service temporarily unavailable. Please try syncing again.",
      },
      status: 503,
    };
  }

  if (error instanceof Error) {
    return {
      body: { error: error.message },
      status: 400,
    };
  }

  return {
    body: { error: fallbackMessage },
    status: 500,
  };
}

exports.isDatabaseConnectionError = isDatabaseConnectionError;
exports.getApiErrorResponse = getApiErrorResponse;
