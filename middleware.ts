import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { IS_INDEXABLE_SITE } from "@/shared/config/seo";
import { getServerRedirectBase } from "@/shared/lib/server-origin";
import { fetchWithSignal, withTimeout } from "@/shared/lib/request-timeout";
import { authFailureCode, isMissingSession } from "@/shared/lib/auth-failure";
import { serviceUnavailableCopy } from "@/shared/i18n/service-unavailable";
import { jwtVerify } from "jose";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PUBLIC_PATHS = ["/login", "/auth", "/api", "/offline", "/privacy"];

function isPathWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

export async function middleware(request: NextRequest) {
  const postgres = process.env.NEXT_PUBLIC_BACKEND === "postgres";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const isRoot = path === "/";
  const isLocalePage = path === "/uk" || path === "/ru";
  const isLegacyMarketing = isPathWithin(path, "/about");
  const isPublic = isRoot || isLocalePage || PUBLIC_PATHS.some((p) => isPathWithin(path, p));
  let isIndexablePage = isRoot || isLocalePage || path === "/privacy";
  const language = path === "/uk" ? "uk" : path === "/ru" ? "ru" : "en";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-deepgym-language", language);
  // Never trust an inbound header or cookie presence as proof of a session.
  requestHeaders.set("x-deepgym-authenticated", "0");

  function decorateResponse(result: NextResponse): NextResponse {
    if (!IS_INDEXABLE_SITE || !isIndexablePage) {
      result.headers.set("X-Robots-Tag", "noindex, follow");
    }
    if (isLocalePage || (isRoot && isIndexablePage)) {
      result.headers.set("Content-Language", language);
    }
    if (isRoot) {
      // Both anonymous and authenticated root responses are session-dependent.
      result.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate");
      result.headers.set("CDN-Cache-Control", "no-store");
      result.headers.set("Vercel-CDN-Cache-Control", "no-store");
      result.headers.append("Vary", "Cookie");
    }
    return result;
  }

  // Resolve invalid/duplicate locale URLs before streaming begins. A late
  // notFound()/redirect() under a loading boundary can otherwise return 200.
  if (["/about", "/about/en", "/about/uk", "/about/ru"].includes(path)) {
    const target = getServerRedirectBase(request.url);
    target.pathname = path === "/about/uk" ? "/uk" : path === "/about/ru" ? "/ru" : "/";
    return decorateResponse(NextResponse.redirect(target, 308));
  }
  if (isLegacyMarketing || path.startsWith("/uk/") || path.startsWith("/ru/")) {
    return decorateResponse(NextResponse.rewrite(new URL("/_not-found", request.url), {
      status: 404,
      request: { headers: requestHeaders },
    }));
  }

  // Crawlers and social-preview bots need the same public HTML as visitors.
  // Each API authenticates its own operation. Checking the previous session
  // before an OAuth callback/OTP request creates an unnecessary outage gate.
  if (isLocalePage || PUBLIC_PATHS.some((p) => isPathWithin(path, p))) {
    return decorateResponse(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // Without auth configuration the public site remains accessible; private
  // routes still go to the login screen, which explains what to set up.
  if (!postgres && (!url || !anonKey)) {
    if (!isPublic) {
      return decorateResponse(NextResponse.redirect(new URL("/login", getServerRedirectBase(request.url))));
    }
    return decorateResponse(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  let authenticated = false;
  const startedAt = Date.now();
  const cookieKey = postgres ? "dg_session" : `sb-${new URL(url!).hostname.split(".")[0]}-auth-token`;
  const hasSessionCookie = request.cookies.getAll().some(({ name }) =>
    name === cookieKey || name.startsWith(`${cookieKey}.`) || (postgres && name === "dg_refresh"),
  );
  // Cookie presence only decides whether validation is necessary. It never
  // grants access, and anonymous visits never depend on the Auth service.
  try {
    if (postgres && hasSessionCookie) authenticated = await withTimeout(async (signal) => {
      if (!process.env.APP_ORIGIN || !process.env.SESSION_SIGNING_SECRET || process.env.SESSION_SIGNING_SECRET.length < 32) throw new Error("AUTH_NOT_CONFIGURED");
      const origin = getServerRedirectBase(request.url).origin;
      const access = request.cookies.get("dg_session")?.value;
      if (access) {
        try {
          const { payload } = await jwtVerify(access, new TextEncoder().encode(process.env.SESSION_SIGNING_SECRET), {
            algorithms: ["HS256"], issuer: `${origin}/api/auth`, audience: "deepgym",
            requiredClaims: ["sub", "sid", "iat", "exp"], maxTokenAge: "900s",
          });
          // This header only chooses the application shell. Every data/storage
          // API independently verifies the live database session and RLS.
          if (typeof payload.sub === "string" && typeof payload.sid === "string") return true;
        } catch { /* Expired access may be renewed by a live opaque session. */ }
      }
      const sessionResponse = await fetchWithSignal(signal)(`${origin}/api/auth/session`, {
        headers: { cookie: request.headers.get("cookie") ?? "" }, cache: "no-store",
      });
      if (!sessionResponse.ok) throw new Error("AUTH_SERVICE_UNAVAILABLE");
      const body = await sessionResponse.json();
      signal.throwIfAborted();
      if (!body.session?.user?.id) return false;
      response.cookies.set("dg_session", body.session.access_token, {
        httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/", maxAge: 900,
      });
      return true;
    }, 6_000, request.signal);
    else if (!postgres && hasSessionCookie) authenticated = await withTimeout(async (signal) => {
      const supabase = createServerClient(url!, anonKey!, {
        global: { fetch: fetchWithSignal(signal) },
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            if (signal.aborted) return;
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            requestHeaders.set("cookie", request.cookies.toString());
            response = NextResponse.next({ request: { headers: requestHeaders } });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      });
      // Verified JWT claims use cached JWKS with asymmetric keys. Supabase
      // falls back to an Auth request for legacy symmetric signing keys.
      const { data, error } = await supabase.auth.getClaims();
      signal.throwIfAborted();
      if (error && !isMissingSession(error)) throw error;
      return !error && Boolean(data?.claims.sub);
    }, 6_000, request.signal);
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.warn(JSON.stringify({
      event: "auth_unavailable", stage: "middleware", requestId,
      durationMs: Date.now() - startedAt, code: authFailureCode(error),
    }));
    const locale = request.headers.get("accept-language")?.toLowerCase() ?? "";
    const errorLang = locale.startsWith("uk") ? "uk" : locale.startsWith("ru") ? "ru" : "en";
    const copy = serviceUnavailableCopy[errorLang];
    // Plain HTML can recover even when the app bundle/backend cannot load.
    const result = new NextResponse(`<!doctype html><html lang="${errorLang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy.title} · DeepGym</title><body style="margin:0;background:#0a0a0c;color:#f5f5f7;font:18px system-ui;display:grid;min-height:100vh;place-items:center"><main style="max-width:32rem;padding:2rem"><h1>${copy.title}</h1><p>${copy.message}</p><button style="font:inherit;padding:12px 24px;background:#d7f651;border:0;border-radius:12px" onclick="location.reload()">${copy.retry}</button></main></body></html>`, {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store",
        "Retry-After": "5", "X-Robots-Tag": "noindex, nofollow", "X-Request-Id": requestId,
      },
    });
    // Preserve the browser's session on infrastructure failures, including if
    // an SDK refresh attempted to clear it while an upstream was unavailable.
    return result;
  }
  requestHeaders.set("x-deepgym-authenticated", authenticated ? "1" : "0");
  if (isRoot) isIndexablePage = !authenticated;

  if (!authenticated && !isPublic) {
    const redirect = NextResponse.redirect(new URL("/login", getServerRedirectBase(request.url)));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return decorateResponse(redirect);
  }
  // Recreate after verification so the page sees the new trusted auth header,
  // preserving any session cookies refreshed by Supabase during getClaims().
  const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.getAll().forEach((cookie) => finalResponse.cookies.set(cookie));
  return decorateResponse(finalResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|robots.txt|sitemap.xml|browserconfig.xml|icons/|avatars/|brand/|social/|screenshots/|.*\\.(?:png|jpe?g|webp|avif|gif|svg|ico|ttf|woff2?)$).*)",
  ],
};
