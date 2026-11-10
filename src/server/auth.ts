import "server-only";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { NextResponse } from "next/server";
import { ACCESS_SECONDS, SESSION_SECONDS, randomToken, readCookie, signAccessToken, tokenHash, validateAuthCsrf, verifyAccessToken } from "./auth-crypto";

export interface AppAuthUser { id: string; email: string; aud: string; role: string; user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown>; created_at: string }
export interface AppSession { access_token: string; refresh_token: string; token_type: "bearer"; expires_in: number; expires_at: number; user: AppAuthUser }
const globalAuth = globalThis as typeof globalThis & { deepgymAuthPool?: Pool };
export const ownAuthEnabled = () => process.env.NEXT_PUBLIC_BACKEND === "postgres";
export function authOrigin() {
  const value = process.env.APP_ORIGIN;
  if (!value) throw new Error("APP_ORIGIN is required for authentication");
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid APP_ORIGIN");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Authentication requires HTTPS");
  return url.origin;
}
export function assertAuthCsrf(request: Request) { validateAuthCsrf(request, authOrigin()); }
function issuer() { return `${authOrigin()}/api/auth`; }
function secret() { return process.env.SESSION_SIGNING_SECRET ?? ""; }

export async function withAuthDb<T>(work: (db: PoolClient) => Promise<T>): Promise<T> {
  if (!globalAuth.deepgymAuthPool) {
    if (!process.env.AUTH_DATABASE_URL) throw new Error("AUTH_DATABASE_URL is required");
    globalAuth.deepgymAuthPool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 10_000, query_timeout: 12_000, idleTimeoutMillis: 30_000, idle_in_transaction_session_timeout: 15_000, allowExitOnIdle: true, application_name: "deepgym-auth" });
    globalAuth.deepgymAuthPool.on("error", () => console.error("[auth] idle database connection failed"));
  }
  const db = await globalAuth.deepgymAuthPool.connect();
  try {
    const role = await db.query("select current_user = 'deepgym_auth' and not rolsuper and not rolbypassrls as safe from pg_roles where rolname=current_user");
    if (!role.rows[0]?.safe) throw new Error("UNSAFE_AUTH_DATABASE_ROLE");
    await db.query("BEGIN");
    const result = await work(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { db.release(); }
}

type UserRow = { id: string; email: string; aud: string; role: string; raw_user_meta_data: Record<string, unknown>; raw_app_meta_data: Record<string, unknown>; created_at: Date };
export async function loadAuthUser(db: PoolClient, id: string): Promise<AppAuthUser | null> {
  const { rows } = await db.query<UserRow>("select id,email,aud,role,raw_user_meta_data,raw_app_meta_data,created_at from auth.users where id=$1 and deleted_at is null and (banned_until is null or banned_until <= now())", [id]);
  const user = rows[0];
  return user ? { id: user.id, email: user.email, aud: user.aud, role: user.role, user_metadata: user.raw_user_meta_data ?? {}, app_metadata: user.raw_app_meta_data ?? {}, created_at: user.created_at.toISOString() } : null;
}

async function makeSession(db: PoolClient, userId: string, sessionId: string, refreshToken = "", knownUser?: AppAuthUser): Promise<AppSession> {
  const user = knownUser ?? await loadAuthUser(db, userId);
  if (!user) throw new Error("ACCOUNT_UNAVAILABLE");
  return { access_token: await signAccessToken(userId, sessionId, secret(), issuer()), refresh_token: refreshToken, token_type: "bearer", expires_in: ACCESS_SECONDS, expires_at: Math.floor(Date.now() / 1000) + ACCESS_SECONDS, user };
}
export async function issueSession(db: PoolClient, userId: string): Promise<AppSession> {
  const user = await loadAuthUser(db,userId);
  if (!user) throw new Error("ACCOUNT_UNAVAILABLE");
  // A source account can have history but no profile. Repair only after a
  // verified login, preserving any existing settings and never treating
  // editable legacy metadata as proof of Telegram ownership.
  const displayName = [user.user_metadata.full_name,user.user_metadata.name].find((value) => typeof value === "string" && value.trim()) as string | undefined;
  await db.query("insert into public.profiles(id,display_name) values($1,$2) on conflict(id) do nothing",[userId,displayName?.slice(0,200) ?? user.email?.split("@")[0]?.slice(0,200) ?? "Athlete"]);
  const refresh = randomToken();
  const id = randomUUID();
  await db.query("insert into auth.deepgym_sessions(id,user_id,refresh_hash,expires_at) values($1,$2,$3,now()+$4*interval '1 second')", [id,userId,tokenHash(refresh),SESSION_SECONDS]);
  return makeSession(db, userId, id, refresh, user);
}
export function setSessionCookies(response: NextResponse, session: AppSession) {
  const options = { httpOnly: true, secure: authOrigin().startsWith("https:"), sameSite: "lax" as const, path: "/" };
  response.cookies.set("dg_session", session.access_token, { ...options, maxAge: ACCESS_SECONDS });
  if (session.refresh_token) response.cookies.set("dg_refresh", session.refresh_token, { ...options, maxAge: SESSION_SECONDS });
}
export function clearSessionCookies(response: NextResponse) {
  for (const name of ["dg_session", "dg_refresh", "dg_oauth"]) response.cookies.set(name, "", { httpOnly: true, secure: authOrigin().startsWith("https:"), sameSite: "lax", path: "/", maxAge: 0 });
}

async function verifiedSessionId(request: Request): Promise<{ userId: string; sessionId: string; expiresAt?: number } | null> {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const token = /^Bearer (\S+)$/i.exec(authorization)?.[1];
    if (!token) return null;
    try { return await verifyAccessToken(token, secret(), issuer()); } catch { return null; }
  }
  const refresh = readCookie(request, "dg_refresh");
  if (refresh && refresh.length <= 256) {
    return withAuthDb(async (db) => {
      const { rows } = await db.query("select id,user_id from auth.deepgym_sessions where refresh_hash=$1 and revoked_at is null and expires_at>now()", [tokenHash(refresh)]);
      return rows[0] ? { userId: rows[0].user_id, sessionId: rows[0].id } : null;
    });
  }
  return null;
}
export async function getAuthenticatedUser(request: Request): Promise<{ id: string } | null> {
  // Browser sessions need just one scoped lookup. A short-lived bearer JWT
  // additionally requires signature/claims verification before its DB lookup.
  if (!request.headers.get("authorization")) {
    const refresh = readCookie(request, "dg_refresh");
    if (!refresh || !/^[A-Za-z0-9_-]{43}$/.test(refresh)) return null;
    return withAuthDb(async (db) => {
      const { rows } = await db.query("select s.user_id from auth.deepgym_sessions s join auth.users u on u.id=s.user_id where s.refresh_hash=$1 and s.revoked_at is null and s.expires_at>now() and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())", [tokenHash(refresh)]);
      return rows[0] ? { id: rows[0].user_id } : null;
    });
  }
  const identity = await verifiedSessionId(request);
  if (!identity) return null;
  return withAuthDb(async (db) => {
    const { rows } = await db.query("select s.user_id from auth.deepgym_sessions s join auth.users u on u.id=s.user_id where s.id=$1 and s.user_id=$2 and s.revoked_at is null and s.expires_at>now() and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())", [identity.sessionId,identity.userId]);
    return rows[0] ? { id: rows[0].user_id } : null;
  });
}

export async function readSession(request: Request): Promise<AppSession | null> {
  const identity = await verifiedSessionId(request);
  if (!identity) return null;
  return withAuthDb(async (db) => {
    const { rows } = await db.query("select id from auth.deepgym_sessions where id=$1 and user_id=$2 and revoked_at is null and expires_at>now()", [identity.sessionId,identity.userId]);
    if (!rows.length) return null;
    const user = await loadAuthUser(db,identity.userId);
    if (!user) return null;
    if (request.headers.get("authorization")) {
      // Possessing an access token must never become a refresh credential.
      // Return its original expiry; only opaque refresh/cookie proof can mint
      // another access token.
      if (!identity.expiresAt) return null;
      return { access_token: request.headers.get("authorization")!.replace(/^Bearer /i,""), refresh_token: "", token_type: "bearer" as const, expires_in: Math.max(0,identity.expiresAt-Math.floor(Date.now()/1000)), expires_at: identity.expiresAt, user };
    }
    return makeSession(db, identity.userId, identity.sessionId,"",user);
  });
}
export async function rotateSession(refresh: string): Promise<AppSession | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(refresh)) return null;
  return withAuthDb(async (db) => {
    const nextRefresh = randomToken();
    // Atomic compare-and-swap: a refresh credential succeeds once, including
    // concurrent requests. Access tokens still reference the live session row.
    const { rows } = await db.query("update auth.deepgym_sessions set refresh_hash=$1 where refresh_hash=$2 and revoked_at is null and expires_at>now() returning id,user_id", [tokenHash(nextRefresh),tokenHash(refresh)]);
    if (!rows[0]) return null;
    const user = await loadAuthUser(db,rows[0].user_id);
    return user ? makeSession(db,rows[0].user_id,rows[0].id,nextRefresh,user) : null;
  });
}
export async function revokeSession(request: Request, refreshProof?: string): Promise<void> {
  // A native access token may have expired before logout. Possession of its
  // opaque refresh credential still proves which session may be revoked.
  if (refreshProof && /^[A-Za-z0-9_-]{43}$/.test(refreshProof)) {
    const revoked = await withAuthDb((db) => db.query("update auth.deepgym_sessions set revoked_at=now() where refresh_hash=$1 returning id", [tokenHash(refreshProof)]).then((result) => result.rows.length > 0));
    if (revoked) return;
    // A concurrent refresh may have consumed that credential. A still-valid
    // access token remains proof of the same session and must revoke it too.
  }
  const identity = await verifiedSessionId(request);
  if (identity) await withAuthDb((db) => db.query("update auth.deepgym_sessions set revoked_at=now() where id=$1 and user_id=$2", [identity.sessionId,identity.userId]).then(() => undefined));
}
