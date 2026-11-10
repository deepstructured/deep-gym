/**
 * Takes README screenshots of the running dev server using the system
 * Chrome (headless) signed in as the demo account.
 *
 * Prereqs: `npm run dev` running on :3000, demo data seeded
 * (node scripts/seed-demo.mjs).
 *
 * Usage: node scripts/take-screenshots.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const BASE = process.env.SCREENSHOT_BASE_URL || "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(BASE).hostname)) {
  throw new Error("Screenshots must use the local development server and demo account");
}
const OUT = join(root, "docs/screenshots");
const CHROME = process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch demo exercise ids to build a prefilled workout draft
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const { data: users } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
const demoUser = users.users.find((u) => u.email === "demo@deepgym.app");
if (!demoUser) throw new Error("Demo user not found — run seed-demo.mjs first");
// Only this explicitly designated demo profile is changed by the capture tool.
const { error: demoProfileError } = await admin.from("profiles").update({
  display_name: "Alex Demo", language: "en", unit: "kg",
  avatar_url: "/avatars/deepgym-pixel-lifter.webp", home_widgets: null,
}).eq("id", demoUser.id);
if (demoProfileError) throw demoProfileError;
const { data: exercises } = await admin
  .from("exercises")
  .select("id, name, equipment, machine_settings, working_weight_kg")
  .eq("user_id", demoUser.id);
const byName = (name) => exercises.find((e) => e.name === name);

const key = () => Math.random().toString(36).slice(2);
const draftExercise = (name, muscleGroupName, sets) => {
  const exercise = byName(name);
  return {
    key: key(),
    exerciseId: exercise.id,
    name: exercise.name,
    muscleGroupName,
    equipment: exercise.equipment,
    machineSettings: exercise.machine_settings,
    unit: "kg",
    notes: "",
    showNotes: false,
    sets: sets.map(([weight, reps, toFailure]) => ({
      key: key(),
      weight: String(weight),
      reps: String(reps),
      toFailure: Boolean(toFailure),
    })),
  };
};

const draft = {
  type: "Upper",
  date: new Date().toISOString().slice(0, 10),
  bodyWeight: "80.65",
  bodyWeightUnit: "kg",
  bodyWeightAuto: false,
  notes: "",
  showNotes: false,
  exercises: [
    draftExercise("Chest Press", "Chest", [
      [52.5, 10],
      [52.5, 9],
      [52.5, 8, true],
    ]),
    draftExercise("Dumbbell Curl", "Biceps", [
      [15, 12],
      [15, 10],
    ]),
  ],
};
const draftJson = () => JSON.stringify({ state: { draft, ownerId: demoUser.id, updatedAt: new Date().toISOString() }, version: 0 });

// ── browser ──────────────────────────────────────────────────────────────
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-first-run"],
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

/** Hide the Next.js dev-tools badge so it doesn't appear in screenshots. */
async function hideDevBadge(target) {
  await target.evaluate(() => {
    if (!document.getElementById("hide-devtools-style")) {
      const style = document.createElement("style");
      style.id = "hide-devtools-style";
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    }
  });
}

async function settle(extra = 600) {
  await page.evaluate(() => document.fonts.ready);
  await hideDevBadge(page);
  await sleep(extra);
}

const captures = [];
async function shot(name) {
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  if (await page.evaluate(() => /Application error|Something went wrong/.test(document.body.innerText))) {
    throw new Error(`Cannot capture an error screen: ${name}`);
  }
  await page.screenshot({ path: join(OUT, name) });
  captures.push(name);
  console.log(`✓ ${name}`);
}

async function clickText(text, tag = "button") {
  const clicked = await page.evaluate(
    (t, sel) => {
      const el = [...document.querySelectorAll(sel)].find(
        (node) => node.textContent.trim() === t,
      );
      if (el) el.click();
      return Boolean(el);
    },
    text,
    tag,
  );
  if (!clicked) throw new Error(`clickText: "${text}" not found`);
}

async function clickAria(label) {
  const clicked = await page.evaluate((l) => {
    const el = document.querySelector(`[aria-label="${l}"]`);
    if (el) el.click();
    return Boolean(el);
  }, label);
  if (!clicked) throw new Error(`clickAria: "${label}" not found`);
}

// sign in as demo
await page.emulateTimezone("Europe/Kyiv");
await page.evaluateOnNewDocument(() => { localStorage.setItem("deepgym-ui-mode", "auto"); });

try {
await page.goto(`${BASE}/api/dev/login?email=demo@deepgym.app`, {
  waitUntil: "networkidle2",
  timeout: 60000,
});

// home
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.waitForFunction(
  () => document.querySelector('[aria-label="Customize home"]') && document.body.innerText.includes("All history"),
);
await settle(1200);
await shot("home.png");

// new workout (prefilled draft via localStorage)
await page.evaluate((json) => {
  localStorage.setItem("deepgym-workout-draft", json);
}, draftJson());
await page.goto(`${BASE}/workouts/new`, { waitUntil: "networkidle2" });
await page.waitForFunction(
  () => document.body.innerText.includes("Chest Press"),
);
await settle();
await shot("new-workout.png");

// plate breakdown (machine): tap plates glyph on the first set
await clickAria("Plate breakdown");
await settle();
await shot("plates-machine.png");
await clickAria("Close");
await sleep(300);

// machine setup sheet
await clickAria("Machine setup");
await settle();
await shot("machine-info.png");
await clickAria("Close");
await sleep(300);

// exercises catalog
await page.goto(`${BASE}/exercises`, { waitUntil: "networkidle2" });
await page.waitForFunction(
  () => document.body.innerText.includes("Chest Press"),
);
await settle();
await shot("exercises.png");

// exercise detail with analytics (Chest Press)
await clickText("Chest Press", "a p");
await page.waitForFunction(
  () => document.body.innerText.includes("Current working weight"),
);
await settle(1200);
await shot("exercise-detail.png");

// dumbbell sheet — Dumbbell Curl detail → plates button
await page.goto(`${BASE}/exercises`, { waitUntil: "networkidle2" });
await page.waitForFunction(
  () => document.body.innerText.includes("Dumbbell Curl"),
);
await clickText("Dumbbell Curl", "a p");
await page.waitForFunction(
  () => document.body.innerText.includes("Current working weight"),
);
await settle();
await clickAria("Plate breakdown");
await settle();
await shot("plates-dumbbell.png");

// history — week & month
await page.goto(`${BASE}/history`, { waitUntil: "networkidle2" });
await page.waitForFunction(
  () => !document.body.innerText.includes("Loading"),
);
await clickText("Week");
await settle(900);
await shot("history-week.png");
await clickText("Month");
await settle(900);
await shot("history-month.png");

// New current product screens used by the README and product landing.
await page.goto(`${BASE}/progress`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.body.innerText.includes("Weekly activity") && document.body.innerText.includes("Body weight"));
await settle(900);
await shot("progress.png");
await page.goto(`${BASE}/templates`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.body.innerText.includes("Upper foundation"));
await settle();
await shot("templates.png");

// login screen (fresh incognito context — signed out)
const incognito = await browser.createBrowserContext();
const loginPage = await incognito.newPage();
await loginPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await loginPage.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await loginPage.evaluate(() => document.fonts.ready);
await hideDevBadge(loginPage);
await sleep(900);
await loginPage.screenshot({ path: join(OUT, "login.png") });
console.log("✓ login.png");
captures.push("login.png");

// Every published derivative is rebuilt from a capture of the current UI.
const publicScreenshots = join(root, "public/screenshots");
mkdirSync(publicScreenshots, { recursive: true });
const publicMap = { home: "home", "new-workout": "new-workout", progress: "progress", history: "history-week", templates: "templates", "exercise-detail": "exercise-detail" };
for (const [output, source] of Object.entries(publicMap)) {
  await sharp(join(OUT, `${source}.png`)).webp({ quality: 88 }).toFile(join(publicScreenshots, `${output}.webp`));
}

// Capture localized UI instead of displaying English screenshots on every locale.
for (const language of ["uk", "ru"]) {
  const { error } = await admin.from("profiles").update({ language }).eq("id", demoUser.id);
  if (error) throw error;
  const localizedOut = join(publicScreenshots, language);
  mkdirSync(localizedOut, { recursive: true });
  for (const [name, path] of Object.entries({ home: "/", "new-workout": "/workouts/new", progress: "/progress", history: "/history", templates: "/templates", "exercise-detail": `/exercises/${byName("Chest Press").id}` })) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
    await page.waitForFunction((lang) => document.documentElement.lang === lang && !document.querySelector('[aria-busy="true"]'), {}, language);
    await settle(1100);
    const bytes = await page.screenshot();
    await sharp(bytes).webp({ quality: 88 }).toFile(join(localizedOut, `${name}.webp`));
    console.log(`✓ public/screenshots/${language}/${name}.webp`);
  }
}

// Also refresh reusable desktop previews; responsive QA has its own capture script.
await admin.from("profiles").update({ language: "en" }).eq("id", demoUser.id);
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await settle(1100);
await shot("home-desktop.png");
await page.goto(`${BASE}/progress`, { waitUntil: "networkidle2" });
await settle(900);
await shot("progress-desktop.png");

const capturedAt = new Date().toISOString();
const screenshotConfig = join(root, "src/shared/config/screenshots.ts");
writeFileSync(screenshotConfig, readFileSync(screenshotConfig, "utf8").replace(
  /export const SCREENSHOT_REVISION = "[^"]+";/,
  `export const SCREENSHOT_REVISION = "${capturedAt.replace(/[^0-9]/g, "")}";`,
));
writeFileSync(join(OUT, "manifest.json"), JSON.stringify({
  capturedAt, timezone: "Europe/Kyiv", account: "demo@deepgym.app",
  source: "current running development app; seeded demo data only",
  mobileViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
  desktopViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
  files: captures.map((file) => ({ file, sha256: createHash("sha256").update(readFileSync(join(OUT, file))).digest("hex") })),
  publicLocales: ["en", "uk", "ru"],
}, null, 2) + "\n");
console.log("done ✓");
} catch (error) {
  console.error("Capture failed on", page.url(), await page.title());
  console.error((await page.evaluate(() => document.body.innerText)).slice(0, 1800));
  await page.screenshot({ path: "/private/tmp/deepgym-capture-error.png" });
  throw error;
} finally {
  await admin.from("profiles").update({ language: "en" }).eq("id", demoUser.id);
  await browser.close();
}
