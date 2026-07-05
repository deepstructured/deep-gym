import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/shared/lib/supabase/admin";
import { getSupabaseServer } from "@/shared/lib/supabase/server";

/**
 * DEV ONLY — sign in as an arbitrary user by email without a password.
 * Used for local testing and screenshot automation:
 *   GET /api/dev/login?email=demo@deepgym.app
 * Disabled entirely in production builds.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties?.hashed_token) {
    return NextResponse.json(
      { error: error?.message ?? "generateLink failed" },
      { status: 500 },
    );
  }

  const supabase = await getSupabaseServer();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/", request.url));
}
