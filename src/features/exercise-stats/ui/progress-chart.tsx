"use client";

import { useId } from "react";
import { formatShort } from "@/shared/lib/dates";

interface ProgressChartProps {
  points: { date: string; value: number }[];
  unit: string;
}

const W = 320;
const H = 140;
const PAD_X = 10;
const PAD_Y = 18;

type ChartPoint = { x: number; y: number };

/** A restrained curve that keeps the data points exact while softening the
 * joins between them. */
function curvedPath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;

  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const previous = points[i - 1] ?? points[i];
    const current = points[i];
    const next = points[i + 1];
    const following = points[i + 2] ?? next;
    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;
    const control2X = next.x - (following.x - current.x) / 6;
    const control2Y = next.y - (following.y - current.y) / 6;
    path += ` C${control1X.toFixed(1)},${control1Y.toFixed(1)} ${control2X.toFixed(1)},${control2Y.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
  }
  return path;
}

/** Dotted, depth-treated chart in the reference's dot-matrix style. */
export function ProgressChart({ points, unit }: ProgressChartProps) {
  const areaGradientId = `progress-area-${useId().replace(/:/g, "")}`;
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

  const chartPoints = points.map((point, index) => ({
    x: x(index),
    y: y(point.value),
  }));
  const path = curvedPath(chartPoints);
  const baseline = H - PAD_Y;
  const areaPath =
    chartPoints.length > 1
      ? `${path} L${chartPoints.at(-1)!.x.toFixed(1)},${baseline} L${chartPoints[0].x.toFixed(1)},${baseline} Z`
      : "";

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div
      className="relative overflow-hidden rounded-[1.4rem] border border-white/[0.05] px-2.5 pt-2 pb-2"
      style={{
        background:
          "radial-gradient(115% 90% at 50% 115%, rgba(64, 84, 214, 0.34) 0%, rgba(24, 39, 136, 0.18) 48%, rgba(10, 10, 12, 0.06) 82%), linear-gradient(180deg, rgba(17, 19, 36, 0.72), rgba(10, 10, 12, 0.4))",
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Progress from ${first.value} to ${last.value} ${unit}`}
      >
        <defs>
          <linearGradient
            id={areaGradientId}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0" stopColor="#4054d6" stopOpacity="0.3" />
            <stop offset="1" stopColor="#182788" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* dotted horizontal guides */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_Y + t * (H - PAD_Y * 2)}
            y2={PAD_Y + t * (H - PAD_Y * 2)}
            stroke="currentColor"
            strokeOpacity="0.14"
            strokeWidth="1"
            strokeDasharray="1 6"
            strokeLinecap="round"
          />
        ))}

        {areaPath && <path d={areaPath} fill={`url(#${areaGradientId})`} />}

        {chartPoints.length > 1 && (
          <line
            x1={chartPoints.at(-1)!.x}
            x2={chartPoints.at(-1)!.x}
            y1={chartPoints.at(-1)!.y + 7}
            y2={baseline}
            stroke="var(--color-lime)"
            strokeOpacity="0.18"
            strokeWidth="1"
            strokeDasharray="1 5"
            strokeLinecap="round"
          />
        )}

        {/* Soft white halo under the trend line. */}
        <path
          d={path}
          fill="none"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.08"
        />
        <path
          d={path}
          fill="none"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.92"
        />

        {points.map((point, index) => {
          const active = index === points.length - 1;
          const chartPoint = chartPoints[index];
          return (
            <g key={point.date}>
              {active && (
                <circle
                  cx={chartPoint.x}
                  cy={chartPoint.y}
                  r="7"
                  fill="var(--color-lime)"
                  opacity="0.16"
                />
              )}
              <circle
                cx={chartPoint.x}
                cy={chartPoint.y}
                r={active ? 3.8 : 2.7}
                fill={active ? "var(--color-lime)" : "white"}
                opacity={active ? 1 : 0.78}
              />
            </g>
          );
        })}

        {/* min/max labels */}
        <text
          x={PAD_X}
          y={12}
          fill="currentColor"
          opacity="0.44"
          fontSize="10"
          fontFamily="var(--font-dot)"
        >
          {max} {unit}
        </text>
        <text
          x={PAD_X}
          y={H - 4}
          fill="currentColor"
          opacity="0.44"
          fontSize="10"
          fontFamily="var(--font-dot)"
        >
          {min} {unit}
        </text>
      </svg>
      <div className="mt-0.5 flex justify-between px-0.5 text-[10px] text-white/35">
        <span>{formatShort(first.date)}</span>
        {points.length > 1 && <span>{formatShort(last.date)}</span>}
      </div>
    </div>
  );
}
