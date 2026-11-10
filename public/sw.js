/* DeepGym service worker — app-shell caching with offline fallback. */
const VERSION = "deepgym-v10";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";
const NAVIGATION_TIMEOUT_MS = 10_000;

async function fetchNavigation(request) {
  const controller = new AbortController();
  let timeout;
  try {
    return await Promise.race([
      fetch(request, { signal: controller.signal }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("Navigation timed out"));
        }, NAVIGATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

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
      caches.open(STATIC_CACHE).catch(() => undefined).then(async (cache) => {
        const cached = await cache?.match(request).catch(() => undefined);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && !response.redirected && !response.headers.get("Content-Type")?.includes("text/html")) {
          if (cache) event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
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
        const cache = await caches.open(PAGE_CACHE).catch(() => undefined);
        // Root is personalized when signed in. Never store or read root HTML,
        // even after an anonymous visit; offline navigation uses the fallback.
        const isPublicPage = ["/uk", "/ru", OFFLINE_URL].includes(url.pathname);
        // Tracking parameters must not create unbounded copies of a public page.
        const cacheKey = new URL(url.pathname, url.origin).href;
        async function fallback(failedResponse) {
          const cached = isPublicPage ? await cache?.match(cacheKey).catch(() => undefined) : undefined;
          const offline = await cache?.match(OFFLINE_URL).catch(() => undefined);
          return cached ?? offline ?? failedResponse ?? new Response("DeepGym · Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
          });
        }
        try {
          const response = await fetchNavigation(request);
          if (response.status >= 500) return fallback(response);
          if (isPublicPage && response.ok && !response.redirected) {
            // Quota/unavailable storage must never replace a good network page.
            if (cache) event.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
          }
          return response;
        } catch {
          return fallback();
        }
      })(),
    );
  }
});
