"use client";

import { useId } from "react";
import type { BodyWeightMeasurement } from "@/entities/body-weight";
import { useI18n } from "@/shared/i18n";
import { formatShort } from "@/shared/lib/dates";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";
import styles from "./body-weight.module.scss";

export interface BodyWeightChartProps {
  measurements: BodyWeightMeasurement[];
  unit: Unit;
  className?: string;
}

const WIDTH = 320;
const HEIGHT = 132;
const PAD_X = 12;
const PAD_Y = 20;

/** Lightweight chronological chart shared by the standalone history card and
 * future profile views. Input order is irrelevant. */
export function BodyWeightChart({
  measurements,
  unit,
  className,
}: BodyWeightChartProps) {
  const { t } = useI18n();
  const gradientId = `body-weight-${useId().replace(/:/g, "")}`;
  if (measurements.length === 0) return null;

  const points = [...measurements]
    .sort(
      (a, b) =>
        a.measured_at.localeCompare(b.measured_at) ||
        a.created_at.localeCompare(b.created_at),
    )
    .map((measurement) => ({
      id: measurement.id,
      date: measurement.measured_at,
      value: roundWeight(kgToUnit(measurement.weight_kg, unit)),
    }));
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(max * 0.02, 1);
  const paddedMin = min - span * 0.15;
  const paddedMax = max + span * 0.15;
  const paddedSpan = paddedMax - paddedMin;

  const chartPoints = points.map((point, index) => ({
    ...point,
    x:
      points.length === 1
        ? WIDTH / 2
        : PAD_X + (index / (points.length - 1)) * (WIDTH - PAD_X * 2),
    y:
      HEIGHT -
      PAD_Y -
      ((point.value - paddedMin) / paddedSpan) * (HEIGHT - PAD_Y * 2),
  }));
  const path = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const baseline = HEIGHT - PAD_Y;
  const areaPath =
    chartPoints.length > 1
      ? `${path} L${chartPoints.at(-1)!.x},${baseline} L${chartPoints[0].x},${baseline} Z`
      : "";
  const first = points[0];
  const last = points.at(-1)!;

  return (
    <div className={`${styles.chart} ${className ?? ""}`}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={styles.chartSvg}
        role="img"
        aria-label={t("bodyWeight.chartAria", {
          from: first.value,
          to: last.value,
          unit,
        })}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-lime)" stopOpacity="0.24" />
            <stop offset="1" stopColor="var(--color-lime)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((position) => (
          <line
            key={position}
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={PAD_Y + position * (HEIGHT - PAD_Y * 2)}
            y2={PAD_Y + position * (HEIGHT - PAD_Y * 2)}
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeDasharray="1 6"
            strokeLinecap="round"
          />
        ))}
        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
        <path
          d={path}
          fill="none"
          stroke="var(--color-lime)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {chartPoints.map((point, index) => (
          <circle
            key={point.id}
            cx={point.x}
            cy={point.y}
            r={index === chartPoints.length - 1 ? 4 : 2.8}
            fill={index === chartPoints.length - 1 ? "var(--color-lime)" : "white"}
            opacity={index === chartPoints.length - 1 ? 1 : 0.72}
          />
        ))}
        <text x={PAD_X} y="12" className={styles.chartValue}>
          {max} {unit}
        </text>
        <text x={PAD_X} y={HEIGHT - 4} className={styles.chartValue}>
          {min} {unit}
        </text>
      </svg>
      <div className={styles.chartDates}>
        <span>{formatShort(first.date)}</span>
        {points.length > 1 && <span>{formatShort(last.date)}</span>}
      </div>
    </div>
  );
}
