"use client";

import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseBrowserConfig } from "./config";

export function createClient() {
  const { url, anonKey } = assertSupabaseBrowserConfig();
  return createBrowserClient(url, anonKey);
}
