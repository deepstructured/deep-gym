/**
 * Render the localized DeepGym link previews from checked-in brand/UI assets.
 * No network, auth, AI generation, or running application is required.
 *
 * Usage: node scripts/generate-social-images.mjs
 * Rendering uses sharp (installed with Next.js) and the system Arial font.
 * Keep generated SVG sources in assets/seo and PNG exports in public/social.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = join(root, "assets/seo");
const outputDirectory = join(root, "public/social");
const width = 1200;
const height = 630;

const copy = {
  en: {
    lines: ["Strength training.", "One clear record."],
    subtitle: "Sets. Reps. Progress.",
    demo: "Demo interface",
    titleSize: 64,
  },
  uk: {
    lines: ["Кожне тренування.", "У твоєму щоденнику."],
    subtitle: "Підходи. Повторення. Прогрес.",
    demo: "Демоінтерфейс",
    titleSize: 57,
  },
  ru: {
    lines: ["Каждая тренировка.", "В твоём дневнике."],
    subtitle: "Подходы. Повторения. Прогресс.",
    demo: "Демо-интерфейс",
    titleSize: 57,
  },
};

const escapeXml = (value) => value.replace(/[<>&"']/g, (character) => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
}[character]));
const dataUri = (mime, bytes) => `data:${mime};base64,${bytes.toString("base64")}`;

const brand = dataUri("image/svg+xml", await readFile(
  join(root, "public/brand/deepgym-symbol-lime-solid.svg"),
));
await mkdir(sourceDirectory, { recursive: true });
await mkdir(outputDirectory, { recursive: true });

for (const [locale, text] of Object.entries(copy)) {
  // Match each public page's language using its current real app capture.
  const screenshot = dataUri("image/png", await sharp(
    join(root, "public/screenshots", locale === "en" ? "" : locale, "new-workout.webp"),
  ).resize(468, 1012, { fit: "fill" }).png().toBuffer());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description" xml:lang="${locale}">
  <title id="title">DeepGym — ${escapeXml(text.lines.join(" "))}</title>
  <desc id="description">${escapeXml(text.subtitle)} ${escapeXml(text.demo)}. deepgym.fit</desc>
  <defs>
    <clipPath id="phone-screen"><rect x="871" y="69" width="234" height="506" rx="21"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#0a0a0c"/>
  <path d="M810 0H1200V630H748Z" fill="#182788"/>
  <path d="M835 0L773 630" stroke="#5361b5" stroke-opacity=".35"/>
  <image xlink:href="${brand}" x="728" y="137" width="488" height="423" opacity=".09"/>
  <image xlink:href="${brand}" x="56" y="58" width="64" height="56"/>
  <g font-family="Arial, Helvetica, sans-serif">
    <text x="132" y="100" font-size="37" font-weight="700" letter-spacing="-1.6" fill="#f4f4f5">DeepGym</text>
    <g font-size="${text.titleSize}" font-weight="700" letter-spacing="-2.3" fill="#f4f4f5">
      <text x="64" y="249">${escapeXml(text.lines[0])}</text>
      <text x="64" y="326" fill="#D7F651">${escapeXml(text.lines[1])}</text>
    </g>
    <text x="66" y="392" font-size="26" letter-spacing="-.3" fill="#a3a3ae">${escapeXml(text.subtitle)}</text>
    <path d="M64 491H692" stroke="#282830"/>
    <circle cx="71" cy="550" r="6" fill="#D7F651"/>
    <text x="92" y="558" font-size="25" font-weight="700" letter-spacing=".2" fill="#f4f4f5">deepgym.fit</text>
    <text x="988" y="606" text-anchor="middle" font-size="15" fill="#c1c7f3">${escapeXml(text.demo)}</text>
  </g>
  <rect x="862" y="60" width="252" height="524" rx="29" fill="#111115" stroke="#676f9e" stroke-width="2"/>
  <image xlink:href="${screenshot}" x="871" y="69" width="234" height="506" clip-path="url(#phone-screen)"/>
</svg>\n`;

  const filename = `deepgym-${locale}`;
  await writeFile(join(sourceDirectory, `${filename}.svg`), svg);
  const png = await sharp(Buffer.from(svg), { density: 144 })
    .resize(width, height)
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  const metadata = await sharp(png).metadata();
  if (metadata.width !== width || metadata.height !== height) {
    throw new Error(`Unexpected dimensions for ${filename}`);
  }
  await writeFile(join(outputDirectory, `${filename}.png`), png);
  console.log(`${filename}.png — ${width}×${height}, ${Math.round(png.length / 1024)} KB`);
}
