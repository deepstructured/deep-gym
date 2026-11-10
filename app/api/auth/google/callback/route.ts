import { NextResponse } from "next/server";
import { authOrigin, ownAuthEnabled } from "@/server/auth";
import { finishGoogle } from "@/server/google-auth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!ownAuthEnabled()) return new NextResponse(null, { status: 404 });
  try { return await finishGoogle(request); }
  catch {
    const response = NextResponse.redirect(new URL("/login?error=oauth", authOrigin()));
    response.cookies.set("dg_oauth", "", { httpOnly: true, path: "/", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
