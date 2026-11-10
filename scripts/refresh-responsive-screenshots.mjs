/**
 * Refresh current desktop/tablet QA screenshots without changing demo records.
 * Prerequisite: a local dev server and the existing demo@deepgym.app account.
 * Usage: node scripts/refresh-responsive-screenshots.mjs
 * Optional: SCREENSHOT_BASE_URL=http://localhost:3000 CHROME_PATH=/path/to/chrome
 * Existing QA PNGs are replaced only after every new capture passes validation.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.SCREENSHOT_BASE_URL || "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) {
  throw new Error("Responsive captures require a local development server");
}
const out = join(root, "output/responsive-qa");
const staging = mkdtempSync(join(tmpdir(), "deepgym-responsive-"));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-first-run"],
});
const captures = [];
const blockedWrites = [];
const obsoleteFiles = [
  "01-progress-before-desktop.png", "02-home-desktop.png", "03-history-desktop.png",
  "04-progress-before-tablet.png", "05-progress-after-desktop.png", "06-exercises-desktop.png",
  "07-exercise-detail-desktop.png", "08-templates-desktop.png", "09-template-editor-desktop.png",
  "10-settings-desktop.png", "11-progress-landscape-tablet.png", "12-progress-after-tablet.png",
];
let committed = false;

try {
  const page = await browser.newPage();
  await page.emulateTimezone("Europe/Kyiv");
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("deepgym-ui-mode", "auto");
    localStorage.setItem("deepgym-lang", "en");
  });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    const dataEndpoint = url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/storage/v1/") || url.pathname === "/api/account/delete";
    if (dataEndpoint && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      blockedWrites.push(`${request.method()} ${url.pathname}`);
      void request.abort();
    } else void request.continue();
  });

  async function open(path, expectedText) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForFunction((text) => document.documentElement.lang === "en" &&
      document.body.innerText.includes(text) && !document.querySelector('[aria-busy="true"]'),
    { timeout: 30000 }, expectedText);
    await page.evaluate(async () => {
      await document.fonts.ready;
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
      await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => {})));
      window.scrollTo(0, 0);
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  async function capture(name, path, expectedText, viewport = { width: 1440, height: 1000 }) {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await open(path, expectedText);
    const review = await page.evaluate(() => ({
      error: /Application error|Something went wrong|Failed to load/.test(document.body.innerText),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      brokenImages: Array.from(document.images).filter((image) => !image.complete || image.naturalWidth === 0).length,
    }));
    if (review.error || review.overflow || review.brokenImages) {
      throw new Error(`${name}: failed UI validation ${JSON.stringify(review)}`);
    }
    const pathToImage = join(staging, name);
    await page.screenshot({ path: pathToImage, captureBeyondViewport: false });
    const metadata = await sharp(pathToImage).metadata();
    if (metadata.width !== viewport.width || metadata.height !== viewport.height) {
      throw new Error(`${name}: incorrect output dimensions`);
    }
    captures.push({
      file: name,
      route: path,
      viewport: { ...viewport, deviceScaleFactor: 1 },
      sha256: createHash("sha256").update(readFileSync(pathToImage)).digest("hex"),
    });
    console.log(`${name} — ${viewport.width}×${viewport.height}, loaded UI verified`);
  }

  await page.goto(`${base}/api/dev/login?email=demo%40deepgym.app`, {
    waitUntil: "networkidle2", timeout: 60000,
  });
  await open("/exercises", "Chest Press");
  const exercisePath = await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="/exercises/"]'))
    .find((link) => link.textContent.includes("Chest Press"))?.getAttribute("href"));
  if (!exercisePath || !/^\/exercises\/[^/?]+$/.test(exercisePath)) throw new Error("Demo Chest Press link missing");
  await open("/templates", "Upper foundation");
  const templatePath = await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="/templates/"]'))
    .find((link) => link.textContent.includes("Upper foundation"))?.getAttribute("href"));
  if (!templatePath || !/^\/templates\/[^/?]+$/.test(templatePath)) throw new Error("Demo template link missing");

  await capture("01-home-desktop.png", "/", "All history");
  await capture("02-history-desktop.png", "/history", "History");
  await capture("03-progress-desktop.png", "/progress", "Weekly activity");
  await capture("04-exercises-desktop.png", "/exercises", "Chest Press");
  await capture("05-exercise-detail-desktop.png", exercisePath, "Current working weight");
  await capture("06-templates-desktop.png", "/templates", "Upper foundation");
  await capture("07-template-editor-desktop.png", `${templatePath}/edit`, "Save");
  await capture("08-settings-desktop.png", "/settings", "Training week");
  await capture("09-progress-tablet.png", "/progress", "Weekly activity", { width: 820, height: 1180 });
  await capture("10-progress-landscape-tablet.png", "/progress", "Weekly activity", { width: 1024, height: 1000 });
  if (blockedWrites.length) throw new Error(`Unexpected record-write attempts blocked: ${blockedWrites.join(", ")}`);

  const manifest = {
    capturedAt: new Date().toISOString(),
    timezone: "Europe/Kyiv",
    account: "demo@deepgym.app",
    source: "Current development web/PWA; read-only navigation, no seeding or record saves",
    files: captures,
  };
  writeFileSync(join(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  mkdirSync(out, { recursive: true });
  for (const capture of captures) copyFileSync(join(staging, capture.file), join(out, capture.file));
  copyFileSync(join(staging, "manifest.json"), join(out, "manifest.json"));
  // Only the superseded, known twelve-file set is removed; unrelated files stay.
  for (const file of obsoleteFiles) rmSync(join(out, file), { force: true });
  committed = true;
  console.log(`Replaced historical QA images with ${captures.length} current captures; manifest saved`);
} finally {
  await browser.close();
  // Keep a failed staging directory available for inspection; existing QA stays intact.
  if (committed) rmSync(staging, { recursive: true });
  else console.error(`Existing QA captures preserved. Incomplete staging: ${staging}`);
}
