import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
function worker(fetch, { storageFails = false, cached = {} } = {}) {
  const handlers = new Map();
  const entries = new Map(Object.entries(cached).map(([key, body]) => [key, new Response(body)]));
  const stored = [];
  const cache = {
    match: async key => entries.get(typeof key === "string" ? key : key.url)?.clone(),
    put: async (key, response) => { stored.push(key); entries.set(key, response); },
  };
  vm.runInNewContext(source, {
    self: { location: { origin: "https://deepgym.test" }, addEventListener: (name, fn) => handlers.set(name, fn) },
    caches: { open: async () => { if (storageFails) throw new Error("storage denied"); return cache; } },
    fetch, URL, Response, AbortController,
    setTimeout: (fn, ms) => setTimeout(fn, ms === 10_000 ? 10 : ms), clearTimeout,
  });
  async function request(path, mode = "navigate") {
    let response;
    const pending = [];
    handlers.get("fetch")({
      request: { method: "GET", mode, url: new URL(path, "https://deepgym.test").href },
      respondWith: promise => { response = promise; },
      waitUntil: promise => pending.push(promise),
    });
    const result = await response;
    await Promise.all(pending);
    return result;
  }
  return { request, stored };
}

test("HTTP 504 on a private route serves only the offline shell, never cached personal HTML", async () => {
  const sw = worker(async () => new Response("upstream timeout", { status: 504 }), {
    cached: { "/offline": "offline shell", "https://deepgym.test/": "another account's dashboard" },
  });
  assert.equal(await (await sw.request("/" )).text(), "offline shell");
  assert.deepEqual(sw.stored, []);
});

test("navigation has a deadline even when fetch never settles or ignores cancellation", async () => {
  let signal;
  const sw = worker((_request, init) => { signal = init.signal; return new Promise(() => {}); }, {
    cached: { "/offline": "offline shell" },
  });
  assert.equal(await (await sw.request("/history")).text(), "offline shell");
  assert.equal(signal.aborted, true);
});

test("a public locale can fall back to its cached public content on 5xx", async () => {
  const sw = worker(async () => new Response("unavailable", { status: 503 }), {
    cached: { "https://deepgym.test/uk": "public Ukrainian page", "/offline": "offline shell" },
  });
  assert.equal(await (await sw.request("/uk?utm_source=example")).text(), "public Ukrainian page");
});

test("unavailable browser cache cannot replace a healthy network response", async () => {
  const sw = worker(async () => new Response("healthy"), { storageFails: true });
  assert.equal(await (await sw.request("/history")).text(), "healthy");
  assert.equal(await (await sw.request("/_next/static/app.js", "cors")).text(), "healthy");
});

test("auth, API and cross-origin traffic bypass service worker interception", async () => {
  const sw = worker(async () => { throw new Error("must not fetch"); });
  for (const path of ["/auth/callback?code=secret", "/api/auth/telegram/verify", "https://api.example.test/auth/v1/user"]) {
    assert.equal(await sw.request(path), undefined);
  }
});

test("only public HTML is saved, under a query-free key; 404s stay visible", async () => {
  const sw = worker(async request => new Response("page", { status: request.url.endsWith("missing") ? 404 : 200 }));
  await sw.request("/uk?utm_source=test");
  await sw.request("/history");
  await sw.request("/");
  assert.deepEqual(sw.stored, ["https://deepgym.test/uk"]);
  assert.equal((await sw.request("/missing")).status, 404);
});
