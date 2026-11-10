/**
 * Render the maintained story templates to 1080 × 1920 PNGs.
 * Refresh docs/screenshots and public/screenshots/uk before rendering.
 * Uses only local HTML/CSS/brand/screenshot files; no login or network access.
 * Output stays in ignored docs/stories. Usage: node scripts/render-stories.mjs
 * Optional: CHROME_PATH=/path/to/chrome node scripts/render-stories.mjs
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "scripts/stories");
const outDir = join(root, "docs/stories");
const width = 1080;
const height = 1920;
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const artifacts = [];

try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const protocol = new URL(request.url()).protocol;
    if (["file:", "data:"].includes(protocol)) void request.continue();
    else void request.abort();
  });

  for (const file of readdirSync(srcDir).filter((name) => name.endsWith(".html")).sort()) {
    await page.goto(pathToFileURL(join(srcDir, file)).href, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (image) => image.decode()));
    });
    const check = await page.evaluate(() => {
      const story = document.querySelector(".story");
      if (!story) throw new Error("Missing .story canvas");
      const sections = Array.from(story.children).map((element) => element.getBoundingClientRect());
      const overlaps = sections.some((rect, index) => index > 0 && rect.top < sections[index - 1].bottom - 1);
      const outside = sections.some((rect) => rect.left < 0 || rect.right > 1080 || rect.top < 0 || rect.bottom > 1920);
      const images = Array.from(document.images).map((image) => ({
        source: image.src,
        valid: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      }));
      const croppedScreens = Array.from(document.querySelectorAll(".phone img")).some((image) => {
        const style = getComputedStyle(image);
        const rect = image.getBoundingClientRect();
        const parent = image.parentElement.getBoundingClientRect();
        return style.objectFit !== "contain" || Number.parseFloat(style.marginTop) < 0 ||
          rect.top < parent.top || rect.bottom > parent.bottom || rect.left < parent.left || rect.right > parent.right;
      });
      return {
        language: document.documentElement.lang,
        destination: document.querySelector(".cta")?.href,
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        overlaps, outside, croppedScreens, images,
      };
    });
    if (check.width !== width || check.height !== height || check.overlaps || check.outside || check.croppedScreens || check.images.some((image) => !image.valid)) {
      throw new Error(`${file}: invalid story layout or assets: ${JSON.stringify(check)}`);
    }
    const expectedDestination = check.language === "uk" ? "https://www.deepgym.fit/uk" : "https://www.deepgym.fit/";
    if (check.destination !== expectedDestination) throw new Error(`${file}: incorrect locale destination`);

    const out = join(outDir, file.replace(".html", ".png"));
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height } });
    artifacts.push({
      source: relative(root, join(srcDir, file)),
      output: relative(root, out),
      language: check.language,
      destination: check.destination,
      width, height,
      assets: check.images.map(({ source }) => {
        const path = fileURLToPath(source);
        return {
          path: relative(root, path),
          sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
        };
      }),
    });
    console.log(`${relative(root, out)} — ${width}×${height}, ${check.language}, layout/assets checked`);
  }
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "Current web/PWA demo screenshots; not native store artwork",
    artifacts,
  }, null, 2)}\n`);
} finally {
  await browser.close();
}
