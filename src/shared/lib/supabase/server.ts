import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/config/env";
import { fetchWithSignal, fetchWithTimeout } from "@/shared/lib/request-timeout";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function getSupabaseServer(options: { signal?: AbortSignal } = {}) {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { fetch: options.signal ? fetchWithSignal(options.signal) : fetchWithTimeout },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        if (options.signal?.aborted) return;
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — session refresh is handled by middleware.
        }
      },
    },
  });
}
