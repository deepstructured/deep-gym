import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/config/env";
import { fetchWithTimeout } from "@/shared/lib/request-timeout";
import { createBackendClient } from "@deepgym/core/backend-auth-client";

let client: SupabaseClient | undefined;

export function getSupabaseBrowser(): SupabaseClient {
  if (process.env.NEXT_PUBLIC_BACKEND === "postgres") {
    client ??= createBackendClient({ origin: typeof window === "undefined" ? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000" : window.location.origin, fetcher: fetchWithTimeout }) as unknown as SupabaseClient;
    return client;
  }
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { fetch: fetchWithTimeout },
  });
  return client;
}
