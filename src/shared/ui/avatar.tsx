import { cn } from "@/shared/lib/cn";

/** Default avatar pictogram, 20×20 pixel grid: an athlete raising a
 *  dumbbell with one arm — matches the app's dot-matrix aesthetic. */
const PIXEL_ROWS = [
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

/** Horizontal pixel runs → one <rect> per run. */
const PIXEL_RUNS: { x: number; y: number; w: number }[] = PIXEL_ROWS.flatMap(
  (row, y) => {
    const runs: { x: number; y: number; w: number }[] = [];
    let start = -1;
    for (let x = 0; x <= row.length; x++) {
      if (row[x] === "#" && start === -1) start = x;
      if (row[x] !== "#" && start !== -1) {
        runs.push({ x: start, y, w: x - start });
        start = -1;
      }
    }
    return runs;
  },
);

export function DefaultAvatarGlyph({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {PIXEL_RUNS.map((run, i) => (
        <rect
          key={i}
          x={run.x}
          y={run.y}
          width={run.w}
          height={1}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

interface AvatarProps {
  /** Custom avatar URL; null/undefined renders the default pictogram. */
  src?: string | null;
  size?: number;
  alt?: string;
  className?: string;
}

export function Avatar({ src, size = 40, alt = "", className }: AvatarProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars are tiny user uploads; next/image adds nothing here
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={cn(
          "shrink-0 rounded-full border border-line object-cover",
          className,
        )}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      role="img"
      aria-label={alt || undefined}
      className={cn(
        "flex shrink-0 items-end justify-center overflow-hidden rounded-full bg-lime text-black",
        className,
      )}
    >
      <DefaultAvatarGlyph size={size * 0.72} />
    </span>
  );
}
