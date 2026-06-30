export function getBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  return token || null;
}
