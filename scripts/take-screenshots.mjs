/**
 * Takes README screenshots of the running dev server using the system
 * Chrome (headless) signed in as the demo account.
 *
 * Prereqs: `npm run dev` running on :3000, demo data seeded
 * (node scripts/seed-demo.mjs).
 *
 * Usage: node scripts/take-screenshots.mjs
 */
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const BASE = "http://localhost:3000";
const OUT = join(root, "docs/screenshots");
const CHROME =
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
const draftJson = JSON.stringify({ state: { draft }, version: 0 });

// ── browser ──────────────────────────────────────────────────────────────
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
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

async function shot(name) {
  await page.screenshot({ path: join(OUT, name) });
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
await page.goto(`${BASE}/api/dev/login?email=demo@deepgym.app`, {
  waitUntil: "networkidle2",
  timeout: 60000,
});

// home
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.waitForFunction(
  () => document.body.innerText.includes("Recent workouts"),
);
await settle(1200);
await shot("home.png");

// new workout (prefilled draft via localStorage)
await page.evaluate((json) => {
  localStorage.setItem("deepgym-workout-draft", json);
}, draftJson);
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

await browser.close();
console.log("done ✓");
