import { NextResponse } from "next/server";
import { getServerRedirectBase, safeLocalRedirectPath } from "@/shared/lib/server-origin";
import { getSupabaseServer } from "@/shared/lib/supabase/server";
import { withTimeout } from "@/shared/lib/request-timeout";
import { authFailureCode } from "@/shared/lib/auth-failure";

/** OAuth (Google) PKCE callback. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectBase = getServerRedirectBase(request.url);
  const code = searchParams.get("code");
  const next = safeLocalRedirectPath(searchParams.get("next"));

  if (code) {
    const startedAt = Date.now();
    try {
      const error = await withTimeout(async (signal) => {
        const supabase = await getSupabaseServer({ signal });
        const result = await supabase.auth.exchangeCodeForSession(code);
        signal.throwIfAborted();
        return result.error;
      }, 12_000, request.signal);
      if (!error) return NextResponse.redirect(new URL(next, redirectBase));
      console.warn(JSON.stringify({ event: "oauth_failed", stage: "exchange", durationMs: Date.now() - startedAt, code: authFailureCode(error) }));
      if (!error.status || error.status >= 500 || error.status === 429) {
        return NextResponse.redirect(new URL("/login?error=unavailable", redirectBase));
      }
    } catch (error) {
      console.warn(JSON.stringify({ event: "oauth_failed", stage: "exchange", durationMs: Date.now() - startedAt, code: authFailureCode(error) }));
      return NextResponse.redirect(new URL("/login?error=unavailable", redirectBase));
    }
  }

  return NextResponse.redirect(new URL("/login?error=oauth", redirectBase));
}
