import { NextResponse } from "next/server";
import { assertAuthCsrf, clearSessionCookies, getAuthenticatedUser, ownAuthEnabled, readSession, revokeSession, rotateSession, setSessionCookies, withAuthDb } from "@/server/auth";
import { readCookie } from "@/server/auth-crypto";
import { exchangeNativeCode } from "@/server/google-auth";
import { readJsonObject, RequestBodyError } from "@/server/request-body";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie, Authorization" };
export async function GET(request: Request) {
  if (!ownAuthEnabled()) return new NextResponse(null, { status: 404 });
  try { return NextResponse.json({ session: await readSession(request) }, { headers }); }
  catch { return NextResponse.json({ error: "Session service unavailable" }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  if (!ownAuthEnabled()) return new NextResponse(null, { status: 404 });
  try { assertAuthCsrf(request); }
  catch { return NextResponse.json({ error: "Invalid request origin" }, { status: 403, headers }); }
  let body;
  try { body = await readJsonObject(request,16_384); }
  catch (error) { return NextResponse.json({ error: "Invalid request body" }, { status: error instanceof RequestBodyError ? error.status : 400, headers }); }
  try {
    if (body.operation === "logout" || body.operation === "reset") {
      const refreshProof = typeof body.refresh_token === "string" ? body.refresh_token : undefined;
      if (body.operation === "reset") await revokeSession(request,refreshProof).catch(() => {});
      else await revokeSession(request,refreshProof);
      const response = NextResponse.json({ session: null }, { headers });
      clearSessionCookies(response);
      return response;
    }
    if (body.operation === "update") {
      const user = await getAuthenticatedUser(request);
      if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401, headers });
      const metadata = Object.fromEntries(Object.entries(body.data ?? {}).filter(([key,value]) => ["full_name","given_name","family_name"].includes(key) && typeof value === "string" && value.length <= 200));
      await withAuthDb((db) => db.query("update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||$1::jsonb,updated_at=now() where id=$2", [JSON.stringify(metadata),user.id]).then(() => undefined));
      return NextResponse.json({ session: await readSession(request) }, { headers });
    }
    const native = request.headers.get("x-deepgym-client") === "native";
    if (native && ["refresh", "set"].includes(String(body.operation)) && typeof body.refresh_token !== "string") {
      return NextResponse.json({ error: "Native refresh requires an explicit credential" }, { status: 400, headers });
    }
    const session = body.operation === "exchange"
      ? await exchangeNativeCode(String(body.code ?? ""), String(body.verifier ?? ""))
      : body.operation === "refresh" || body.operation === "set"
        ? await rotateSession(String(body.refresh_token ?? readCookie(request, "dg_refresh") ?? ""))
        : null;
    if (!session) return NextResponse.json({ error: "Invalid or expired session credential" }, { status: 401, headers });
    const response = NextResponse.json({ session: { ...session, refresh_token: native ? session.refresh_token : "" } }, { headers });
    setSessionCookies(response, session);
    return response;
  } catch { return NextResponse.json({ error: "Session service unavailable" }, { status: 503, headers }); }
}
