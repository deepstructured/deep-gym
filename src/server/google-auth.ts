import "server-only";
import { randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/shared/lib/request-timeout";
import { safeLocalRedirectPath } from "@/shared/lib/server-origin";
import { authOrigin, issueSession, setSessionCookies, withAuthDb } from "./auth";
import { pkceChallenge, randomToken, readCookie, tokenHash } from "./auth-crypto";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), { timeoutDuration: 5000 });
const NATIVE_RETURN = "deepgym://auth/callback";
const callbackUrl = () => `${authOrigin()}/api/auth/google/callback`;
function googleConfig() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_NOT_CONFIGURED");
  return { id, secret };
}

export async function startGoogle(request: Request): Promise<NextResponse> {
  const config = googleConfig();
  const params = new URL(request.url).searchParams;
  const native = params.get("redirect_to") === NATIVE_RETURN;
  const challenge = native ? params.get("code_challenge") : null;
  if (native && (!challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge))) {
    return NextResponse.json({ error: "Native sign-in requires PKCE" }, { status: 400 });
  }
  const state = randomToken(), verifier = randomToken(), nonce = randomToken(), binding = randomToken();
  const returnTo = native ? NATIVE_RETURN : safeLocalRedirectPath(params.get("next"));
  await withAuthDb(async (db) => {
    await db.query("delete from auth.deepgym_oauth_states where expires_at<now()");
    await db.query("insert into auth.deepgym_oauth_states(state_hash,verifier,nonce,browser_binding_hash,return_to,client_challenge,expires_at) values($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')", [tokenHash(state),verifier,nonce,tokenHash(binding),returnTo,challenge]);
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: config.id, redirect_uri: callbackUrl(), response_type: "code", scope: "openid email profile", state, nonce, code_challenge: pkceChallenge(verifier), code_challenge_method: "S256" }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set("dg_oauth", binding, { httpOnly: true, secure: authOrigin().startsWith("https:"), sameSite: "lax", path: "/", maxAge: 600 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function finishGoogle(request: Request): Promise<NextResponse> {
  const params = new URL(request.url).searchParams;
  const state = params.get("state"), code = params.get("code"), binding = readCookie(request, "dg_oauth");
  if (!state || !code || !binding || state.length > 256 || code.length > 4096) throw new Error("INVALID_OAUTH_STATE");
  const flow = await withAuthDb(async (db) => {
    // Bound to this browser and consumed atomically. Replayed callbacks cannot
    // mint another session, even if two requests arrive simultaneously.
    const { rows } = await db.query("delete from auth.deepgym_oauth_states where state_hash=$1 and browser_binding_hash=$2 and expires_at>now() returning *", [tokenHash(state),tokenHash(binding)]);
    if (rows.length !== 1) throw new Error("INVALID_OAUTH_STATE");
    return rows[0];
  });
  const config = googleConfig();
  const tokenResponse = await fetchWithTimeout("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: config.id, client_secret: config.secret, redirect_uri: callbackUrl(), code_verifier: flow.verifier }) });
  if (!tokenResponse.ok) throw new Error("GOOGLE_EXCHANGE_FAILED");
  const tokens = await tokenResponse.json();
  if (typeof tokens.id_token !== "string") throw new Error("GOOGLE_ID_TOKEN_MISSING");
  const { payload } = await jwtVerify(tokens.id_token, googleKeys, { algorithms: ["RS256"], audience: config.id, issuer: ["https://accounts.google.com", "accounts.google.com"], requiredClaims: ["sub", "email", "exp", "iat", "nonce"] });
  if (payload.nonce !== flow.nonce || payload.email_verified !== true || typeof payload.email !== "string" || !payload.sub) throw new Error("GOOGLE_IDENTITY_INVALID");
  const result = await withAuthDb(async (db) => {
    // Serialize first sign-in for one provider identity without trusting email
    // as an account-linking proof. Imported identities retain their exact UUID.
    await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [`google:${payload.sub}`]);
    const identity = await db.query("select user_id from auth.identities where provider='google' and provider_id=$1", [payload.sub]);
    let userId: string = identity.rows[0]?.user_id;
    if (!userId) {
      const existing = await db.query("select id from auth.users where lower(email)=lower($1) limit 1", [payload.email]);
      if (existing.rows.length) throw new Error("ACCOUNT_IDENTITY_NOT_IMPORTED");
      userId = randomUUID();
      await db.query("insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,created_at,updated_at) values($1,$2,'authenticated','authenticated',$3,$4,now(),now(),now())", [userId,payload.email,{ provider: "google", providers: ["google"] },{ full_name: payload.name, avatar_url: payload.picture }]);
      await db.query("insert into auth.identities(id,user_id,provider_id,provider,identity_data,created_at,updated_at,last_sign_in_at) values($1,$2,$3,'google',$4,now(),now(),now())", [randomUUID(),userId,payload.sub,{ sub: payload.sub, email: payload.email, email_verified: true }]);
    }
    await db.query("update auth.identities set last_sign_in_at=now() where provider='google' and provider_id=$1", [payload.sub]);
    if (flow.return_to === NATIVE_RETURN) {
      const exchangeCode = randomToken();
      await db.query("insert into auth.deepgym_oauth_codes(code_hash,user_id,client_challenge,expires_at) values($1,$2,$3,now()+interval '2 minutes')", [tokenHash(exchangeCode),userId,flow.client_challenge]);
      return { code: exchangeCode, session: null };
    }
    return { code: null, session: await issueSession(db, userId) };
  });
  const destination = result.code ? `${NATIVE_RETURN}?code=${encodeURIComponent(result.code)}` : new URL(safeLocalRedirectPath(flow.return_to), authOrigin()).href;
  const response = NextResponse.redirect(destination);
  if (result.session) setSessionCookies(response, result.session);
  response.cookies.set("dg_oauth", "", { httpOnly: true, secure: authOrigin().startsWith("https:"), path: "/", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function exchangeNativeCode(code: string, verifier: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return null;
  return withAuthDb(async (db) => {
    const { rows } = await db.query("delete from auth.deepgym_oauth_codes where code_hash=$1 and client_challenge=$2 and expires_at>now() returning user_id", [tokenHash(code),pkceChallenge(verifier)]);
    return rows[0] ? issueSession(db, rows[0].user_id) : null;
  });
}
