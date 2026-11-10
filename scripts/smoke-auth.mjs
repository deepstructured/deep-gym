/** Local fixture smoke test. Start Next on 3100 with Supabase URL
 * http://127.0.0.1:3999, a dummy anon key, and APP_ORIGIN=http://localhost:3100.
 * No production API or real account is used; all browser egress is blocked.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const app = "http://localhost:3100";
const api = "http://127.0.0.1:3999";
const cookieName = "sb-127-auth-token";
const ids = { a: "11111111-1111-4111-8111-111111111111", b: "22222222-2222-4222-8222-222222222222" };
const fixture = { hangAuth: false, failProfile: false, missingProfile: false, onboarding: 999, counts: new Map() };
const results = [];
const errors = [];
const reportDir = "/private/tmp/deepgym-auth-smoke";

function session(account) {
  const now = Math.floor(Date.now() / 1000);
  const user = { id: ids[account], email: `${account}@fixture.invalid`, aud: "authenticated", role: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role: "authenticated", iat: now, exp: now + 3600, iss: `${api}/auth/v1` })}.Zml4dHVyZQ`;
  return { access_token: token, refresh_token: `fixture-${account}`, expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user };
}
const sessions = { a: session("a"), b: session("b") };
const cookieValue = (value) => `base64-${Buffer.from(JSON.stringify(value)).toString("base64url")}`;
const cookieHeader = `${cookieName}=${cookieValue(sessions.a)}`;

function profile(userId) {
  return { id: userId, display_name: userId === ids.b ? "Bravo Fixture" : "Alpha Fixture", language: "en", unit: "kg", bar_weight_kg: 20, plates_kg: [20, 10, 5, 2.5], plates_lb: [], avatar_url: null, telegram_id: null, telegram_username: null, onboarding_version: fixture.onboarding, last_seen_release_version: 999, training_schedule: null, body_weight_kg: null, home_widgets: null, created_at: "2026-01-01T00:00:00Z" };
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", app);
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] ?? "authorization,apikey,x-client-info,content-type,prefer,range,range-unit");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  const url = new URL(req.url, api);
  fixture.counts.set(url.pathname, (fixture.counts.get(url.pathname) ?? 0) + 1);
  const auth = req.headers.authorization ?? "";
  const account = auth.includes(sessions.b.access_token) ? "b" : "a";
  function json(value, status = 200) { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); }
  if (url.pathname === "/auth/v1/user") {
    if (!fixture.hangAuth) json(sessions[account].user);
  } else if (url.pathname === "/auth/v1/logout") {
    json({});
  } else if (url.pathname === "/rest/v1/profiles") {
    if (fixture.failProfile) json({ message: "Fixture profile unavailable", code: "XX000" }, 500);
    else if (fixture.missingProfile) json({ message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116", details: "The result contains 0 rows" },406);
    else json(profile(url.searchParams.get("id")?.replace(/^eq\./, "") ?? ids[account]));
  } else if (url.pathname === "/rest/v1/rpc/ensure_current_profile") {
    fixture.missingProfile = false;
    json(profile(ids[account]));
  } else if (url.pathname === "/rest/v1/rpc/home_dashboard_summary") {
    json({ total: 0, activity: [], records: [], lifts: [], recentExerciseIds: [], muscleSets: {} });
  } else if (url.pathname === "/rest/v1/workout_drafts") {
    json(null);
  } else if (url.pathname.startsWith("/rest/v1/")) {
    res.setHeader("Content-Range", "*/0");
    json([]);
  } else json({ message: `Unhandled fixture ${url.pathname}` }, 404);
});

let browser;
async function newPage(context) {
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    const allowed = ["http://localhost:3100", "http://127.0.0.1:3100", api].includes(url.origin) || ["data:", "blob:"].includes(url.protocol);
    void (allowed ? request.continue() : request.abort()).catch(() => {});
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
}
async function contextFor(account) {
  const context = await browser.createBrowserContext();
  await context.setCookie({ name: cookieName, value: cookieValue(sessions[account]), domain: "localhost", path: "/", sameSite: "Lax" });
  return context;
}
async function waitText(page, text) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout: 25_000 }, text);
}
async function clickText(page, text) {
  await page.evaluate((expected) => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === expected);
    if (!button) throw new Error(`Missing button ${expected}`);
    button.click();
  }, text);
}
async function navigateLink(page, href) {
  await page.evaluate((destination) => {
    const link = [...document.querySelectorAll("a")].find((item) => item.getAttribute("href") === destination && item.getClientRects().length);
    if (!link) throw new Error(`Missing visible link ${destination}`);
    link.click();
  }, href);
}
function passed(name, details = {}) { results.push({ name, ...details }); console.log(`PASS ${name} ${JSON.stringify(details)}`); }

try {
  await mkdir(reportDir, { recursive: true });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(3999, "127.0.0.1", resolve); });
  // Warm compilation before measuring the auth deadline.
  for (const path of ["/api/health", "/login", "/history"]) await fetch(`${app}${path}`);
  fixture.hangAuth = true;
  const beforeHungAuth = fixture.counts.get("/auth/v1/user") ?? 0;
  const start = performance.now();
  const failed = await fetch(`${app}/history`, { headers: { cookie: cookieHeader }, redirect: "manual" });
  const durationMs = Math.round(performance.now() - start);
  assert.equal(failed.status, 503);
  assert.ok((fixture.counts.get("/auth/v1/user") ?? 0) > beforeHungAuth, "The fixture Auth request must actually start");
  assert.ok(durationMs >= 5500, `Auth failed before the configured deadline: ${durationMs}ms`);
  assert.ok(durationMs < 8000, `Deadline took ${durationMs}ms`);
  assert.equal(failed.headers.get("set-cookie"), null, "An outage must preserve the session cookie");
  passed("middleware auth deadline preserves session", { status: failed.status, durationMs });
  const authCalls = fixture.counts.get("/auth/v1/user");
  for (const path of ["/login", "/api/health"]) {
    const response = await fetch(`${app}${path}`, { headers: { cookie: cookieHeader } });
    assert.equal(response.status, 200);
  }
  assert.equal(fixture.counts.get("/auth/v1/user"), authCalls);
  passed("login and health bypass unavailable Auth");
  fixture.hangAuth = false;

  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--disable-background-networking"] });
  fixture.failProfile = true;
  fixture.onboarding = 0;
  const recoveryContext = await contextFor("a");
  const recoveryPage = await newPage(recoveryContext);
  await recoveryPage.goto(`${app}/onboarding`, { waitUntil: "domcontentloaded" });
  await waitText(recoveryPage, "We couldn't open your profile");
  assert.equal(await recoveryPage.$('[role="status"][aria-busy="true"]'), null);
  await recoveryPage.screenshot({ path: `${reportDir}/profile-error.png` });
  passed("onboarding profile failure reaches a terminal recovery screen");
  fixture.failProfile = false;
  await clickText(recoveryPage, "Try again");
  await waitText(recoveryPage, "Every workout");
  await recoveryPage.screenshot({ path: `${reportDir}/onboarding-recovered.png` });
  passed("profile retry opens onboarding");
  await recoveryContext.close();

  fixture.onboarding = 999;
  fixture.missingProfile = true;
  const repairContext = await contextFor("a");
  const repairPage = await newPage(repairContext);
  const repairsBefore = fixture.counts.get("/rest/v1/rpc/ensure_current_profile") ?? 0;
  await repairPage.goto(app,{waitUntil:"domcontentloaded"});
  await waitText(repairPage,"Alpha");
  assert.equal(fixture.counts.get("/rest/v1/rpc/ensure_current_profile"),repairsBefore+1);
  assert.equal(fixture.missingProfile,false);
  await repairPage.screenshot({path:`${reportDir}/profile-repaired.png`});
  passed("missing own profile is repaired once through the authenticated RPC");
  await repairContext.close();

  const context = await contextFor("a");
  const page = await newPage(context);
  await page.goto(app, { waitUntil: "domcontentloaded" });
  await waitText(page, "Alpha");
  await page.waitForFunction(() => !document.querySelector('[role="status"][aria-busy="true"]'));
  const profileReads = fixture.counts.get("/rest/v1/profiles");
  const summaryReads = fixture.counts.get("/rest/v1/rpc/home_dashboard_summary");
  await navigateLink(page, "/progress");
  await waitText(page, "Progress");
  await page.waitForFunction(() => !document.querySelector('[role="status"][aria-busy="true"]'));
  await navigateLink(page, "/");
  await waitText(page, "Alpha");
  await page.waitForFunction(() => !document.querySelector('[role="status"][aria-busy="true"]'));
  assert.equal(fixture.counts.get("/rest/v1/profiles"), profileReads);
  assert.equal(fixture.counts.get("/rest/v1/rpc/home_dashboard_summary"), summaryReads);
  passed("Home to Progress to Home reuses profile and summary cache");

  const otherTab = await newPage(context);
  await otherTab.goto(`${app}/login?error=oauth`, { waitUntil: "domcontentloaded" });
  await context.setCookie({ name: cookieName, value: cookieValue(sessions.b), domain: "localhost", path: "/", sameSite: "Lax" });
  await otherTab.evaluate((newSession) => {
    const channel = new BroadcastChannel("sb-127-auth-token");
    channel.postMessage({ event: "SIGNED_IN", session: newSession });
    setTimeout(() => channel.close(), 100);
  }, sessions.b);
  await page.bringToFront();
  await waitText(page, "Bravo");
  assert.equal(await page.evaluate(() => document.body.innerText.includes("Alpha")), false);
  await page.screenshot({ path: `${reportDir}/account-switched.png` });
  passed("cross-tab account change replaces previous profile and component state");
  await page.goto(`${app}/settings`, { waitUntil: "domcontentloaded" });
  await waitText(page, "Bravo Fixture");
  await clickText(page, "Sign out");
  await page.waitForFunction(() => location.pathname === "/login");
  await waitText(page, "Continue with Google");
  assert.equal((await context.cookies()).some((cookie) => cookie.name === cookieName), false);
  passed("sign-out clears session and returns to login");
  assert.deepEqual(errors, []);
  passed("no uncaught browser runtime exceptions");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  results.push({ failed: String(error) });
  if (browser) {
    for (const [index, page] of (await browser.pages()).entries()) {
      await writeFile(`${reportDir}/failure-${index}.txt`, await page.evaluate(() => document.body.innerText).catch(() => "Page unavailable"));
      await page.screenshot({ path: `${reportDir}/failure-${index}.png` }).catch(() => {});
    }
  }
} finally {
  await writeFile(`${reportDir}/report.json`, JSON.stringify({ results, browserErrors: errors }, null, 2));
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
