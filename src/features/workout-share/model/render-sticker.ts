import type { Workout } from "@/entities/workout";
import { kgToUnit, type Unit } from "@/shared/lib/weight";

/** Sticker card geometry (canvas pixels). The canvas itself is transparent —
 *  only the rounded lime card is painted, so on a photo it reads as a sticker. */
const CARD_W = 1000;
const RADIUS = 96;
const PAD = 88;

const LIME = "#d7f651";
const INK = "#14141a";

/** 24×24 pixel barbell — same sprite as the "barbell" preset avatar.
 *  '#' = solid ink, '+' = translucent ink (bar and collars). */
const BARBELL = [
  "........................",
  "........................",
  "........................",
  "........................",
  "....###..........###...",
  "....###..........###...",
  "....###..........###...",
  ".##.###..........###.##",
  ".##.###..........###.##",
  ".##.###.+........###.##",
  ".##.###.+......+.###.##",
  "++++###++++++++++###+++",
  "++++###++++++++++###+++",
  ".##.###.+......+.###.##",
  ".##.###.+........###.##",
  ".##.###..........###.##",
  ".##.###..........###.##",
  "....###..........###...",
  "....###..........###...",
  "....###..........###...",
  "........................",
  "........................",
  "........................",
  "........................",
];

export interface StickerLabels {
  brand: string;
  volume: string;
}

function resolveFontStack(variable: string, fallback: string): string {
  const probe = document.createElement("span");
  probe.style.fontFamily = `var(${variable})`;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();
  return family || fallback;
}

/** 12345 → "12 345". */
function formatThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function wrapWords(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Renders a transparent-background PNG sticker: pixel barbell, workout type
 *  and session volume on a rounded lime card — for pasting onto a photo. */
export async function renderWorkoutSticker(
  workout: Workout,
  unit: Unit,
  labels: StickerLabels,
): Promise<Blob> {
  await document.fonts.ready;
  const sans = resolveFontStack("--font-sans", "sans-serif");
  const dot = resolveFontStack("--font-dot", "monospace");

  let totalVolumeKg = 0;
  for (const we of workout.workout_exercises) {
    for (const set of we.sets) {
      if (set.weight_kg != null && set.reps != null) {
        totalVolumeKg += set.weight_kg * set.reps;
      }
    }
  }
  const volumeText = `${formatThousands(Math.round(kgToUnit(totalVolumeKg, unit)))} ${unit}`;

  // ── measure the type lines to size the card ──────────────────────────
  const measure = document.createElement("canvas").getContext("2d")!;
  const typeFont = `900 96px ${sans}`;
  measure.font = typeFont;
  const typeLines = wrapWords(
    measure,
    workout.type.toUpperCase(),
    CARD_W - PAD * 2,
  ).slice(0, 2);

  // sprite rows 4..19 are the visible part of the barbell
  const cell = 11;
  const iconH = 16 * cell;
  const typeLineH = 104;
  const gapIconType = 64;
  const gapTypeLabel = 76;
  const labelH = 34;
  const gapLabelVolume = 62;
  const volumeH = 96;
  const gapVolumeBrand = 88;
  const brandH = 40;

  const cardH =
    PAD +
    iconH +
    gapIconType +
    typeLines.length * typeLineH +
    gapTypeLabel +
    labelH +
    gapLabelVolume +
    volumeH +
    gapVolumeBrand +
    brandH +
    PAD;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = cardH;
  const ctx = canvas.getContext("2d")!;

  // ── card ─────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.roundRect(0, 0, CARD_W, cardH, RADIUS);
  ctx.fillStyle = LIME;
  ctx.fill();

  // ── pixel barbell, centered ──────────────────────────────────────────
  const iconW = 24 * cell;
  const iconX = (CARD_W - iconW) / 2;
  const iconTop = PAD - 4 * cell; // sprite starts at row 4
  for (let row = 0; row < BARBELL.length; row++) {
    for (let col = 0; col < BARBELL[row].length; col++) {
      const cellChar = BARBELL[row][col];
      if (cellChar === ".") continue;
      ctx.fillStyle = INK;
      ctx.globalAlpha = cellChar === "+" ? 0.5 : 1;
      ctx.fillRect(iconX + col * cell, iconTop + row * cell, cell, cell);
    }
  }
  ctx.globalAlpha = 1;

  // ── text, centered ───────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;

  let y = PAD + iconH + gapIconType + 78;
  ctx.font = typeFont;
  for (const line of typeLines) {
    ctx.fillText(line, CARD_W / 2, y);
    y += typeLineH;
  }
  y -= typeLineH;

  y += gapTypeLabel + labelH;
  ctx.font = `700 30px ${sans}`;
  ctx.globalAlpha = 0.55;
  try {
    ctx.letterSpacing = "6px";
  } catch {
    /* older engines just render without tracking */
  }
  ctx.fillText(labels.volume.toUpperCase(), CARD_W / 2, y);
  ctx.globalAlpha = 1;

  y += gapLabelVolume + volumeH - 20;
  ctx.font = `128px ${dot}`;
  try {
    ctx.letterSpacing = "0px";
  } catch {
    /* ignore */
  }
  ctx.fillText(volumeText, CARD_W / 2, y);

  y += gapVolumeBrand + brandH - 6;
  ctx.font = `44px ${dot}`;
  try {
    ctx.letterSpacing = "10px";
  } catch {
    /* ignore */
  }
  ctx.globalAlpha = 0.65;
  ctx.fillText(labels.brand, CARD_W / 2, y);
  ctx.globalAlpha = 1;

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not render image")),
      "image/png",
    ),
  );
}
