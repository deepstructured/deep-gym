import { roundWeight } from "@/shared/lib/weight";
import type { ProgressMetric } from "./stats";

/** 12345 → "12 345" (thin no-break spaces keep it on one line). */
export function formatThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatSigned(value: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized > 0 ? `+${normalized}` : String(normalized);
}

/** A metric value already converted to the display unit. */
export function formatMetricValue(
  value: number,
  metric: ProgressMetric,
): string {
  if (metric === "volume") return formatThousands(Math.round(value));
  if (metric === "reps") return String(Math.round(value));
  const rounded = roundWeight(value);
  return metric === "addedLoad" ? formatSigned(rounded) : String(rounded);
}

/** Signed difference for delta chips, in the metric's precision. */
export function formatMetricDelta(
  value: number,
  metric: ProgressMetric,
): string {
  const rounded =
    metric === "volume" || metric === "reps"
      ? Math.round(value)
      : roundWeight(value);
  const text =
    metric === "volume" ? formatThousands(Math.abs(rounded)) : String(Math.abs(rounded));
  return rounded > 0 ? `+${text}` : rounded < 0 ? `−${text}` : "0";
}

export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded)}%`;
}
