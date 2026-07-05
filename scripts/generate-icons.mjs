/**
 * Generates DeepGym PWA icons — dot-matrix "DG" on a near-black background,
 * matching the app's Matricha aesthetic. Zero dependencies: hand-rolled PNG
 * encoder (RGBA, zlib deflate).
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── PNG encoder ──────────────────────────────────────────────────────────
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // scanlines with filter byte 0
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Drawing ──────────────────────────────────────────────────────────────
const BG = [10, 10, 12];
const LIME = [215, 246, 81];
const PINK = [245, 103, 133];

// 5×7 dot grids
const LETTER_D = [
  "1111.",
  "1...1",
  "1...1",
  "1...1",
  "1...1",
  "1...1",
  "1111.",
];
const LETTER_G = [
  ".111.",
  "1...1",
  "1....",
  "1.111",
  "1...1",
  "1...1",
  ".111.",
];

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  // background with a subtle radial glow toward the bottom
  const cx = size / 2;
  const glowY = size * 0.85;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - glowY) / size;
      const glow = Math.max(0, 1 - d * 1.6) ** 2 * 0.35;
      const i = (y * size + x) * 4;
      rgba[i] = Math.min(255, BG[0] + PINK[0] * glow * 0.35);
      rgba[i + 1] = Math.min(255, BG[1] + PINK[1] * glow * 0.12);
      rgba[i + 2] = Math.min(255, BG[2] + PINK[2] * glow * 0.3);
      rgba[i + 3] = 255;
    }
  }

  function dot(px, py, radius, [r, g, b]) {
    const x0 = Math.max(0, Math.floor(px - radius - 1));
    const x1 = Math.min(size - 1, Math.ceil(px + radius + 1));
    const y0 = Math.max(0, Math.floor(py - radius - 1));
    const y1 = Math.min(size - 1, Math.ceil(py + radius + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dist = Math.hypot(x - px, y - py);
        const alpha = Math.max(0, Math.min(1, radius - dist + 0.5));
        if (alpha <= 0) continue;
        const i = (y * size + x) * 4;
        rgba[i] = Math.round(rgba[i] * (1 - alpha) + r * alpha);
        rgba[i + 1] = Math.round(rgba[i + 1] * (1 - alpha) + g * alpha);
        rgba[i + 2] = Math.round(rgba[i + 2] * (1 - alpha) + b * alpha);
      }
    }
  }

  // Layout: "D G" — 11 columns × 7 rows of dots, centered, inside the
  // maskable safe zone (80% of the icon).
  const cols = 11;
  const rows = 7;
  const cell = (size * 0.62) / cols;
  const originX = (size - cols * cell) / 2 + cell / 2;
  const originY = (size - rows * cell) / 2 + cell / 2;
  const radius = cell * 0.34;

  const letters = [
    { grid: LETTER_D, offset: 0 },
    { grid: LETTER_G, offset: 6 },
  ];
  for (const { grid, offset } of letters) {
    grid.forEach((row, ry) => {
      [...row].forEach((ch, rx) => {
        if (ch !== "1") return;
        dot(
          originX + (offset + rx) * cell,
          originY + ry * cell,
          radius,
          LIME,
        );
      });
    });
  }
  // signature pink dot — bottom right of the G
  dot(originX + 10 * cell, originY + 8.2 * cell, radius * 0.9, PINK);

  return encodePng(size, size, rgba);
}

// ── Output ───────────────────────────────────────────────────────────────
mkdirSync(join(root, "public/icons"), { recursive: true });

const targets = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/icon-maskable-512.png", 512],
  ["app/icon.png", 64],
  ["app/apple-icon.png", 180],
];

for (const [file, size] of targets) {
  writeFileSync(join(root, file), drawIcon(size));
  console.log(`✓ ${file} (${size}×${size})`);
}
