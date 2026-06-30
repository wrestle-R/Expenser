import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertSupabaseBrowserConfig } from "./config";

export async function createClient() {
  const { url, anonKey } = assertSupabaseBrowserConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; middleware refresh handles it.
        }
      },
    },
  });
}
