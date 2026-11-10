import { NextResponse } from "next/server";
import { ownAuthEnabled } from "@/server/auth";
import { startGoogle } from "@/server/google-auth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!ownAuthEnabled()) return new NextResponse(null, { status: 404 });
  try { return await startGoogle(request); }
  catch { return NextResponse.json({ error: "Google sign-in is unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
