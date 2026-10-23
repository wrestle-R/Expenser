import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { createClient, type Session } from "@supabase/supabase-js";
import { ENV } from "../env";

const storageKey = `sb-${new URL(ENV.SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

// Read the SDK's persisted session before it begins refreshing an expired token.
// Cached identity unlocks local data only; the server still validates every API request.
export const initialSession: Promise<Session | null> = AsyncStorage.getItem(storageKey)
  .then((value) => {
    if (!value) return null;
    const session = JSON.parse(value);
    return session?.user?.id && session?.access_token && session?.refresh_token ? session as Session : null;
  })
  .catch(() => null);

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  global: {
    fetch: async (input, init) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (init?.signal?.aborted) abort();
      init?.signal?.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(abort, 10_000);
      try {
        return await fetch(input, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
        init?.signal?.removeEventListener("abort", abort);
      }
    },
  },
  auth: {
    storage: AsyncStorage,
    storageKey,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
