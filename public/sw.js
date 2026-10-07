/* DeepGym service worker — app-shell caching with offline fallback. */
const VERSION = "deepgym-v9";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("deepgym-") && key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept API / auth / cross-origin (Supabase, Telegram) traffic
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/") ||
      url.pathname === "/auth" || url.pathname.startsWith("/auth/") ||
      ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"].includes(url.pathname))
    return;

  // Hashed build assets + fonts: cache-first
  if (request.mode !== "navigate" && (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:woff2?|ttf|png|webp|svg|ico)$/.test(url.pathname)
  )) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && !response.redirected && !response.headers.get("Content-Type")?.includes("text/html")) {
          event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
        }
        return response;
      }),
    );
    return;
  }

  // Only public HTML is cached. Never retain a signed-in user's page after
  // sign-out or serve it to a different account on a shared device.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGE_CACHE);
        // Root is personalized when signed in. Never store or read root HTML,
        // even after an anonymous visit; offline navigation uses the fallback.
        const isPublicPage = ["/uk", "/ru", OFFLINE_URL].includes(url.pathname);
        // Tracking parameters must not create unbounded copies of a public page.
        const cacheKey = new URL(url.pathname, url.origin).href;
        try {
          const response = await fetch(request);
          if (isPublicPage && response.ok && !response.redirected) {
            // Quota/unavailable storage must never replace a good network page.
            await cache.put(cacheKey, response.clone()).catch(() => {});
          }
          return response;
        } catch {
          const cached = isPublicPage ? await cache.match(cacheKey) : undefined;
          return cached ?? (await cache.match(OFFLINE_URL)) ?? Response.error();
        }
      })(),
    );
  }
});
