import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabasePublicConfig } from "./env";

export function createClient() {
  const { url, key } = getSupabasePublicConfig();

  return createBrowserClient<Database>(
    url,
    key,
  );
}
