declare const process: { env?: Record<string, string | undefined> };

export const CONFIG = {
  apiUrl:
    process.env?.EXPO_PUBLIC_API_URL || "https://expenser-rdp.vercel.app",
  clerkPublishableKey:
    process.env?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    "pk_test_Z3VpZGluZy1jYWltYW4tNjIuY2xlcmsuYWNjb3VudHMuZGV2JA",
};

function decodeBase64(input: string) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  let buffer = 0;
  let bits = 0;

  for (const char of input.replace(/=+$/, "")) {
    const value = chars.indexOf(char);
    if (value < 0) {
      continue;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

export function getClerkFrontendApi(): string {
  const encoded = CONFIG.clerkPublishableKey.replace(/^pk_(test|live)_/, "");
  const decoded = decodeBase64(encoded);
  return decoded.replace(/\$$/, "");
}
