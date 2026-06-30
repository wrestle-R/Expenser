import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { getBearerToken } from "@/lib/auth-token";
import { assertSupabaseBrowserConfig } from "@/lib/supabase/config";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
}

export async function getAuthenticatedUser(req?: Request) {
  const bearerToken = getBearerToken(req?.headers.get("authorization") ?? null);
  const config = assertSupabaseBrowserConfig();
  const supabase = bearerToken
    ? createSupabaseJsClient(config.url, config.anonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : await createSupabaseServerClient();

  const { data, error } = await supabase.auth.getUser(
    bearerToken ?? undefined
  );

  if (error || !data.user) {
    return null;
  }

  const metadata = data.user.user_metadata ?? {};
  const name =
    typeof metadata.name === "string"
      ? metadata.name
      : typeof metadata.full_name === "string"
        ? metadata.full_name
        : "";

  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    name,
  } satisfies AuthenticatedUser;
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
