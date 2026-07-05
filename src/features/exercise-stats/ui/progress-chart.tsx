"use client";

import { formatShort } from "@/shared/lib/dates";

interface ProgressChartProps {
  points: { date: string; value: number }[];
  unit: string;
}

const W = 320;
const H = 140;
const PAD_X = 10;
const PAD_Y = 18;

/** Minimal dotted line chart in the reference's dot-matrix style. */
export function ProgressChart({ points, unit }: ProgressChartProps) {
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) =>
    points.length === 1
      ? W / 2
      : PAD_X + (i / (points.length - 1)) * (W - PAD_X * 2);
  const y = (value: number) =>
    H - PAD_Y - ((value - min) / span) * (H - PAD_Y * 2);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Progress from ${first.value} to ${last.value} ${unit}`}
      >
        {/* dotted horizontal guides */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_Y + t * (H - PAD_Y * 2)}
            y2={PAD_Y + t * (H - PAD_Y * 2)}
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeWidth="1"
            strokeDasharray="1.5 5"
          />
        ))}

        <path
          d={path}
          fill="none"
          stroke="var(--color-lime)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />

        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={x(i)}
            cy={y(p.value)}
            r={i === points.length - 1 ? 4 : 2.6}
            fill={i === points.length - 1 ? "var(--color-lime)" : "var(--color-bg)"}
            stroke="var(--color-lime)"
            strokeWidth="1.6"
          />
        ))}

        {/* min/max labels */}
        <text
          x={PAD_X}
          y={12}
          fill="currentColor"
          opacity="0.5"
          fontSize="10"
          fontFamily="var(--font-dot)"
        >
          {max} {unit}
        </text>
        <text
          x={PAD_X}
          y={H - 4}
          fill="currentColor"
          opacity="0.5"
          fontSize="10"
          fontFamily="var(--font-dot)"
        >
          {min} {unit}
        </text>
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-faint">
        <span>{formatShort(first.date)}</span>
        {points.length > 1 && <span>{formatShort(last.date)}</span>}
      </div>
    </div>
  );
}
