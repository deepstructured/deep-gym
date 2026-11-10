import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const ACCESS_SECONDS = 15 * 60;
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const randomToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const pkceChallenge = (value: string) => createHash("sha256").update(value).digest("base64url");

function signingKey(secret: string) {
  if (Buffer.byteLength(secret) < 32) throw new Error("SESSION_SIGNING_SECRET must contain at least 32 random bytes");
  return new TextEncoder().encode(secret);
}
export async function signAccessToken(userId: string, sessionId: string, secret: string, issuer: string) {
  if (!UUID_PATTERN.test(userId) || !UUID_PATTERN.test(sessionId)) throw new Error("Invalid session identity");
  return new SignJWT({ sid: sessionId, role: "authenticated" }).setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId).setIssuer(issuer).setAudience("deepgym").setIssuedAt()
    .setExpirationTime(`${ACCESS_SECONDS}s`).sign(signingKey(secret));
}
export async function verifyAccessToken(token: string, secret: string, issuer: string) {
  const { payload } = await jwtVerify(token, signingKey(secret), {
    algorithms: ["HS256"], issuer, audience: "deepgym", requiredClaims: ["sub", "sid", "iat", "exp"],
    maxTokenAge: `${ACCESS_SECONDS}s`,
  });
  if (!UUID_PATTERN.test(payload.sub ?? "") || typeof payload.sid !== "string" || !UUID_PATTERN.test(payload.sid)) {
    throw new Error("Invalid session identity");
  }
  return { userId: payload.sub!, sessionId: payload.sid, expiresAt: payload.exp! };
}

export function readCookie(request: Request, name: string): string | null {
  const values = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim());
  const value = values.find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  try { return value ? decodeURIComponent(value) : null; } catch { return null; }
}

export function validateAuthCsrf(request: Request, origin: string): void {
  const source = request.headers.get("origin");
  if ((source && source !== origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new Error("CROSS_ORIGIN_AUTH_REQUEST");
  }
  // A native client has no Origin/cookies. Cookie-authenticated browser writes
  // require an exact Origin; JSON-only endpoints do not accept HTML forms.
  if (!source && request.headers.get("cookie") && !request.headers.get("authorization")) {
    throw new Error("AUTH_ORIGIN_REQUIRED");
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("AUTH_JSON_REQUIRED");
  }
}
