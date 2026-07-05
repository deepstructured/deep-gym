/**
 * Renders the Instagram stories (1080×1920 PNG) from scripts/stories/*.html.
 * Usage: node scripts/render-stories.mjs
 */
import { mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "scripts/stories");
const outDir = join(root, "docs/stories");
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".html"))) {
  await page.goto(pathToFileURL(join(srcDir, file)).href, {
    waitUntil: "networkidle0",
  });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  const out = join(outDir, file.replace(".html", ".png"));
  await page.screenshot({ path: out });
  console.log(`✓ ${out}`);
}

await browser.close();
