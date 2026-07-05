import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/shared/config/env";

/** Service-role client. Server-side only — bypasses RLS. */
export function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
