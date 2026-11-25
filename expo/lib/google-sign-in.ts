import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

function preparePkce() {
  // Hermes supplies TextEncoder but may not expose a Web Crypto digest.
  if (typeof globalThis.crypto?.getRandomValues === "function" &&
      typeof globalThis.crypto?.subtle?.digest === "function") return;

  const crypto: Partial<Crypto> = globalThis.crypto ?? {};
  if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: crypto, configurable: true });
  if (typeof crypto.getRandomValues !== "function") {
    Object.defineProperty(crypto, "getRandomValues", { value: Crypto.getRandomValues, configurable: true });
  }
  const subtle = crypto.subtle ?? {};
  if (!crypto.subtle) Object.defineProperty(crypto, "subtle", { value: subtle, configurable: true });
  if (!("digest" in subtle) || typeof subtle.digest !== "function") {
    Object.defineProperty(subtle, "digest", {
      configurable: true,
      value: (algorithm: string, data: Uint8Array<ArrayBuffer>) => {
        if (algorithm !== "SHA-256") throw new Error("Unsupported digest");
        return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data);
      },
    });
  }
}

export async function signInWithGoogle(scheme: "expenser" | "expenser-lite") {
  preparePkce();
  const redirectTo = `${scheme}://sign-in`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Could not start Google sign-in.");

  const authUrl = new URL(data.url);
  if (authUrl.searchParams.get("code_challenge_method")?.toLowerCase() !== "s256") {
    throw new Error("Secure Google sign-in is unavailable on this device.");
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return false;
  const callback = new URL(result.url);
  if (`${callback.protocol}//${callback.host}${callback.pathname}` !== redirectTo ||
      callback.username || callback.password || callback.hash || callback.searchParams.has("error")) {
    throw new Error("Google sign-in could not be completed.");
  }
  const codes = callback.searchParams.getAll("code");
  if (codes.length !== 1 || !codes[0]) throw new Error("Google sign-in returned no authorization code.");
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(codes[0]);
  if (exchangeError) throw exchangeError;
  return true;
}
