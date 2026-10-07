import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { IS_INDEXABLE_SITE } from "@/shared/config/seo";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PUBLIC_PATHS = ["/login", "/auth", "/api", "/offline", "/privacy"];

function isPathWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

export async function middleware(request: NextRequest) {
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
    const target = request.nextUrl.clone();
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
  // Marketing and legal pages must not depend on Supabase/session availability.
  if (isLocalePage || path === "/privacy" || path === "/offline") {
    return decorateResponse(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // Without auth configuration the public site remains accessible; private
  // routes still go to the login screen, which explains what to set up.
  if (!url || !anonKey) {
    if (!isPublic) {
      return decorateResponse(NextResponse.redirect(new URL("/login", request.url)));
    }
    return decorateResponse(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        requestHeaders.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  let authenticated = false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    authenticated = Boolean(user);
  } catch {
    // A failed/expired session cannot expose the dashboard. Guests can still
    // read the landing page if the auth service is temporarily unavailable.
  }
  requestHeaders.set("x-deepgym-authenticated", authenticated ? "1" : "0");
  if (isRoot) isIndexablePage = !authenticated;

  if (!authenticated && !isPublic) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return decorateResponse(redirect);
  }
  if (authenticated && path === "/login") {
    const redirect = NextResponse.redirect(new URL("/", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return decorateResponse(redirect);
  }

  // Recreate after verification so the page sees the new trusted auth header,
  // preserving any session cookies refreshed by Supabase during getUser().
  const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.getAll().forEach((cookie) => finalResponse.cookies.set(cookie));
  return decorateResponse(finalResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|robots.txt|sitemap.xml|browserconfig.xml|icons/|avatars/|brand/|social/|screenshots/|.*\\.(?:png|jpe?g|webp|avif|gif|svg|ico|ttf|woff2?)$).*)",
  ],
};
