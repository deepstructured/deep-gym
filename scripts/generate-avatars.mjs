/**
 * Regenerates legacy profile avatars in public/avatars/*.svg.
 *
 * These files are no longer offered by the picker, but must remain available
 * because existing profiles may still store their public URLs. Current picker
 * presets are the checked-in DeepGym WebP assets and are not generated here.
 *
 * Each avatar is a 24×24 pixel-art sprite (OKX-style: flat bold background,
 * chunky pixels, checkerboard dithering for shading) clipped to a circle.
 *
 * Cell characters:
 *   '.'  background (transparent over the bg circle)
 *   '#'  primary color        '%'  primary, 50% checkerboard
 *   '+'  secondary color      '~'  secondary, 50% checkerboard
 *
 * Usage: npm run avatars:legacy
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 24;
const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "avatars",
);

const emptyGrid = () =>
  Array.from({ length: SIZE }, () => Array(SIZE).fill("."));

/** The 20×20 athlete from the default avatar glyph, centered on 24×24. */
function lifterRows() {
  const art = [
    "............##...##.",
    "............#######.",
    ".....###....#######.",
    "....#####...####.##.",
    "....#####....##.....",
    "....#####...##......",
    ".....###...##.......",
    "...........##.......",
    "..........##........",
    "...########.........",
    "..#########.........",
    "..#########.........",
    "..#########.........",
    "..#########.........",
    "..##.######.........",
    "..##.######.........",
    "..##.######.........",
    "..##.######.........",
    "..##.######.........",
    "..##.######.........",
  ];
  const pad = ".".repeat(SIZE);
  return [
    pad,
    pad,
    ...art.map((row) => `..${row}..`),
    pad,
    pad,
  ];
}

function barbellRows() {
  const g = emptyGrid();
  for (let y = 4; y <= 19; y++)
    for (const x of [4, 5, 6, 17, 18, 19]) g[y][x] = "#"; // big plates
  for (let y = 7; y <= 16; y++)
    for (const x of [1, 2, 21, 22]) g[y][x] = "#"; // small plates
  for (let y = 9; y <= 14; y++) for (const x of [8, 15]) g[y][x] = "+"; // collars
  for (let y = 11; y <= 12; y++)
    for (let x = 0; x < SIZE; x++) if (g[y][x] === ".") g[y][x] = "+"; // bar
  return g.map((row) => row.join(""));
}

function plateRows() {
  const g = emptyGrid();
  const c = (SIZE - 1) / 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d <= 10.3 && d >= 3.4) g[y][x] = d >= 8.4 ? "%" : "#";
    }
  }
  // bolt marks around the hub
  for (const [x, y] of [
    [11, 6],
    [12, 6],
    [11, 17],
    [12, 17],
    [6, 11],
    [6, 12],
    [17, 11],
    [17, 12],
  ]) {
    g[y][x] = "+";
  }
  return g.map((row) => row.join(""));
}

function pulseRows() {
  const g = emptyGrid();
  // EKG trace: (x, y of the line's top pixel), drawn 2px thick
  const trace = [
    [2, 13], [3, 13], [4, 13], [5, 13], [6, 13],
    [7, 12], [8, 10], [9, 7], [10, 4], [11, 7],
    [12, 10], [13, 13], [14, 16], [15, 13],
    [16, 13], [17, 13], [18, 13], [19, 13], [20, 13],
  ];
  for (const [x, y] of trace) {
    g[y][x] = "#";
    g[y + 1][x] = "#";
  }
  // small heart, top right
  const heart = [
    [17, 4], [18, 4], [20, 4], [21, 4],
    [16, 5], [17, 5], [18, 5], [19, 5], [20, 5], [21, 5], [22, 5],
    [16, 6], [17, 6], [18, 6], [19, 6], [20, 6], [21, 6], [22, 6],
    [17, 7], [18, 7], [19, 7], [20, 7], [21, 7],
    [18, 8], [19, 8], [20, 8],
    [19, 9],
  ];
  for (const [x, y] of heart) g[y][x] = "+";
  return g.map((row) => row.join(""));
}

const AVATARS = [
  {
    id: "lifter",
    bg: "#d7f651",
    primary: "#14141a",
    secondary: "#14141a",
    rows: lifterRows(),
  },
  {
    id: "biceps",
    bg: "#f0567c",
    primary: "#14141a",
    secondary: "#d7f651",
    rows: [
      "........................",
      "........................",
      "........................",
      "...............#####....",
      "..............#######...",
      "..............#######...",
      "..............#######...",
      "...............#####....",
      "..............#####.....",
      ".............#####......",
      "............#####.......",
      "...........#####........",
      "..........#####.........",
      ".....##########.........",
      "...#############........",
      "..###############.......",
      "..################......",
      "..################......",
      "..#################.....",
      "...################.....",
      "....##############......",
      "......###########.......",
      "........................",
      "........................",
    ],
  },
  {
    id: "kettlebell",
    bg: "#5b5bf0",
    primary: "#14141a",
    secondary: "#d7f651",
    rows: [
      "........................",
      "........................",
      "........########........",
      ".......##########.......",
      ".......###....###.......",
      "......###......###......",
      "......##........##......",
      "......##........##......",
      ".....####......####.....",
      "....######....######....",
      "...##################...",
      "..####################..",
      "..####################..",
      "..####################..",
      "..####################..",
      "..####################..",
      "..############%%%%%%%%..",
      "...###########%%%%%%%...",
      "....##########%%%%%%....",
      "......############......",
      ".........######.........",
      "........................",
      "........................",
      "........................",
    ],
  },
  {
    id: "barbell",
    bg: "#14141a",
    primary: "#d7f651",
    secondary: "#9d9da8",
    rows: barbellRows(),
  },
  {
    id: "plate",
    bg: "#ff7a3c",
    primary: "#14141a",
    secondary: "#ffd23c",
    rows: plateRows(),
  },
  {
    id: "shaker",
    bg: "#4cc9f0",
    primary: "#14141a",
    secondary: "#eef2f6",
    rows: [
      "........................",
      "........................",
      "..........####..........",
      "..........####..........",
      ".........######.........",
      ".......##########.......",
      ".......##########.......",
      "........########........",
      "........########........",
      "........########........",
      "........#+######........",
      "........########........",
      "........########........",
      "........#+######........",
      "........########........",
      "........########........",
      "........#+######........",
      "........########........",
      "........########........",
      "........########........",
      "........########........",
      "........................",
      "........................",
      "........................",
    ],
  },
  {
    id: "gorilla",
    bg: "#c9ccd6",
    primary: "#14141a",
    secondary: "#8d93a1",
    rows: [
      "........................",
      "........................",
      "........................",
      ".......##########.......",
      ".....##############.....",
      "....################....",
      "...##################...",
      "...##################...",
      "..####################..",
      "..####################..",
      "..####################..",
      "..#####++######++#####..",
      "..#####++######++#####..",
      "..####################..",
      "..######++++++++######..",
      "..#####++++++++++#####..",
      "..#####++#++++#++#####..",
      "..#####++++++++++#####..",
      "...#####++++++++#####...",
      "...##################...",
      "....################....",
      "......############......",
      "........................",
      "........................",
    ],
  },
  {
    id: "bull",
    bg: "#d0342c",
    primary: "#14141a",
    secondary: "#f5e9c8",
    rows: [
      "........................",
      "........................",
      "........................",
      "...++..............++...",
      "..+++..............+++..",
      "...+++............+++...",
      "....+++..........+++....",
      ".....++##########++.....",
      ".....##############.....",
      ".....##############.....",
      ".....##++######++##.....",
      ".....##############.....",
      ".....##############.....",
      "......############......",
      ".......##########.......",
      ".......##########.......",
      ".......++++++++++.......",
      ".......+#++++++#+.......",
      ".......++++++++++.......",
      "........########........",
      "........................",
      "........................",
      "........................",
      "........................",
    ],
  },
  {
    id: "pulse",
    bg: "#14141a",
    primary: "#d7f651",
    secondary: "#f0567c",
    rows: pulseRows(),
  },
  {
    id: "flame",
    bg: "#1e1b4b",
    primary: "#ff7a3c",
    secondary: "#ffd23c",
    rows: [
      "........................",
      "........................",
      "............#...........",
      "...........##...........",
      "...........###..........",
      "..........####..........",
      "..........#####.........",
      ".........######.........",
      ".........#######........",
      "........########........",
      ".......##########.......",
      "......############......",
      "......############......",
      ".....#####+++######.....",
      ".....####+++++#####.....",
      "....#####++++++#####....",
      "....#####++++++#####....",
      "....#####++++++#####....",
      ".....####++++++####.....",
      "......####++++####......",
      ".......###++++###.......",
      "........###++###........",
      "........................",
      "........................",
    ],
  },
];

/** Merge horizontal runs of solid cells into single rects; checker cells
 *  are emitted per-pixel (they can't merge). */
function renderRects({ rows, primary, secondary }) {
  const fills = { "#": primary, "+": secondary };
  const checkers = { "%": primary, "~": secondary };
  const rects = [];

  rows.forEach((row, y) => {
    let runChar = null;
    let runStart = -1;
    const flush = (endX) => {
      if (runChar == null) return;
      rects.push(
        `<rect x="${runStart}" y="${y}" width="${endX - runStart}" height="1" fill="${fills[runChar]}"/>`,
      );
      runChar = null;
    };
    for (let x = 0; x <= SIZE; x++) {
      const cell = row[x] ?? ".";
      if (cell !== runChar) flush(x);
      if (cell === "#" || cell === "+") {
        if (runChar == null) {
          runChar = cell;
          runStart = x;
        }
      } else if (checkers[cell] && (x + y) % 2 === 0) {
        rects.push(
          `<rect x="${x}" y="${y}" width="1" height="1" fill="${checkers[cell]}"/>`,
        );
      }
    }
  });

  return rects.join("\n    ");
}

function renderSvg(avatar) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="96" height="96" shape-rendering="crispEdges">
  <defs>
    <clipPath id="c"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}"/></clipPath>
  </defs>
  <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="${avatar.bg}"/>
  <g clip-path="url(#c)">
    ${renderRects(avatar)}
  </g>
</svg>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const avatar of AVATARS) {
  if (avatar.rows.length !== SIZE) {
    throw new Error(`${avatar.id}: expected ${SIZE} rows, got ${avatar.rows.length}`);
  }
  for (const [index, row] of avatar.rows.entries()) {
    if (row.length !== SIZE) {
      throw new Error(`${avatar.id}: row ${index} is ${row.length} chars, expected ${SIZE}`);
    }
    if (/[^.#+%~]/.test(row)) {
      throw new Error(`${avatar.id}: row ${index} has unknown characters`);
    }
  }
  writeFileSync(join(OUT_DIR, `${avatar.id}.svg`), renderSvg(avatar));
}
console.log(`wrote ${AVATARS.length} avatars to public/avatars/`);
