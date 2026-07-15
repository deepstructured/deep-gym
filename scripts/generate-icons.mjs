/**
 * Installs the curated DeepGym Night Reverse brand exports.
 *
 * The checked-in sources under assets/brand/night-reverse are immutable,
 * production-approved files from the logo pack. This script only verifies and
 * copies them; it never redraws, resizes, or otherwise transforms the mark.
 *
 * Usage:
 *   node scripts/generate-icons.mjs         # verify sources and install targets
 *   node scripts/generate-icons.mjs --check # verify sources and targets, no writes
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(root, "assets/brand/night-reverse");
const checkOnly = process.argv.includes("--check");

const unknownArguments = process.argv.slice(2).filter((arg) => arg !== "--check");
if (unknownArguments.length > 0) {
  throw new Error(`Unknown argument: ${unknownArguments.join(" ")}`);
}

const assets = [
  {
    source: "app-icon-64x64.png",
    sha256: "d1e1beaff688c43d19226c2561cde0a1d4cbe38d48812c4ed9bb3c0e195f12bb",
    targets: ["app/icon.png"],
  },
  {
    source: "favicon/apple-touch-icon.png",
    sha256: "978b557d8ea221acfe45abc571b7d869c80903143469299530a508cece096fa0",
    targets: ["app/apple-icon.png", "public/apple-touch-icon.png"],
  },
  {
    source: "favicon/browserconfig.xml",
    sha256: "56e820d29aecc835ac927da8ce665044e3a70393e7d6ba4b520c90d1ecb3eb4e",
    targets: ["public/browserconfig.xml"],
  },
  {
    source: "favicon-dotted/favicon-16x16.png",
    sha256: "432fdf833a4ad9d6fd9b1fe3d5d3b176e781cc1494b12b693b6fa8e2f6377913",
    targets: ["public/favicon-16x16.png"],
  },
  {
    source: "favicon-dotted/favicon-32x32.png",
    sha256: "ae28504e8768e14566e58f027a795114852cb46c401ead1595f3125860d12756",
    targets: ["public/favicon-32x32.png"],
  },
  {
    source: "favicon-dotted/favicon-48x48.png",
    sha256: "7dc7340ad151886750c4156003679eb0634defb4163c3ac42a0718fd0ec5fac0",
    targets: ["public/favicon-48x48.png"],
  },
  {
    source: "favicon-dotted/favicon.ico",
    sha256: "102b9a390787b16fba2e8e9aad606acf81e2103a81a62fbf33e775abdddb3506",
    targets: ["app/favicon.ico"],
  },
  {
    source: "favicon-dotted/favicon.svg",
    sha256: "8a5d9b789a41e6ac61d05948900c3a6caf2761569689d5c2c554046c64fe670b",
    targets: ["public/favicon.svg"],
  },
  {
    source: "favicon/mstile-150x150.png",
    sha256: "35fab068360a87ee6c8a2ecc33eb8509b52e26f2968498a67c628f19bf7724b7",
    targets: ["public/mstile-150x150.png"],
  },
  {
    source: "favicon/safari-pinned-tab.svg",
    sha256: "50db571dc19201933efe649d069461b90c54f43e119d0305e0e941472d32e6a6",
    targets: ["public/safari-pinned-tab.svg"],
  },
  {
    source: "pwa/android-chrome-192x192.png",
    sha256: "381052099ed3903e1d9aef48d0ca127d62ead37dd27c0b0cde3c6c57e9e8abff",
    targets: ["public/icons/icon-192.png"],
  },
  {
    source: "pwa/android-chrome-512x512.png",
    sha256: "db0721373f49324c8d4cff25575ad6a61a7ac73a854b1009eec1b8fc737a4162",
    targets: ["public/icons/icon-512.png"],
  },
  {
    source: "pwa/maskable-icon-192x192.png",
    sha256: "b874a8e51f0b99595d0eb1c38320661ac3675d1a12ab29622efcf3432245e7c8",
    targets: ["public/icons/icon-maskable-192.png"],
  },
  {
    source: "pwa/maskable-icon-512x512.png",
    sha256: "b95f8adb9e8011442862af947fa8f8269a9f9df571c1db50dc7962e1d980b2bd",
    targets: ["public/icons/icon-maskable-512.png"],
  },
  {
    source: "marks/deepgym-symbol-lime-solid.svg",
    sha256: "35e654c8301a361e803fd189e125e2a2788189fe5b4f9ca7833ea4c6ddfd3e91",
    targets: ["public/brand/deepgym-symbol-lime-solid.svg"],
  },
  {
    source: "marks/deepgym-symbol-lime-compact.svg",
    sha256: "94402ac5a5bedab09ce357bf5713338d0a4f0822df8b75738623ea0d8097d9b0",
    targets: ["public/brand/deepgym-symbol-lime-compact.svg"],
  },
  {
    source: "marks/deepgym-symbol-lime-detailed.svg",
    sha256: "20eb509cc2dae0dc62980331184d36ca159c3e98fde973f9789add82b26f88f6",
    targets: ["public/brand/deepgym-symbol-lime-detailed.svg"],
  },
];

function digest(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

for (const asset of assets) {
  const source = join(sourceRoot, asset.source);
  const sourceDigest = digest(source);

  if (sourceDigest !== asset.sha256) {
    throw new Error(
      `Brand source checksum mismatch: ${asset.source}\n` +
        `Expected ${asset.sha256}\nReceived ${sourceDigest}`,
    );
  }

  for (const targetPath of asset.targets) {
    const target = join(root, targetPath);

    if (checkOnly) {
      if (!existsSync(target)) {
        throw new Error(
          `Brand target is missing: ${targetPath}\n` +
            `Run npm run icons to restore approved assets.`,
        );
      }
      if (digest(target) !== asset.sha256) {
        throw new Error(
          `Brand target checksum mismatch: ${targetPath}\n` +
            `Run npm run icons to restore approved assets.`,
        );
      }
      console.log(`✓ ${targetPath}`);
      continue;
    }

    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);

    if (digest(target) !== asset.sha256) {
      throw new Error(`Brand asset copy failed verification: ${targetPath}`);
    }

    console.log(`✓ ${asset.source} -> ${targetPath}`);
  }
}
