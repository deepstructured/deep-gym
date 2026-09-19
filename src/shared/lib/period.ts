"use client";

import { addDays, subMonths, subYears } from "date-fns";
import { toISODate } from "./dates";
import { createStoredPreference } from "./preference";

/** Look-back windows offered by every progress chart. */
export const PERIOD_KEYS = ["1m", "3m", "6m", "1y", "all"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

/** A quarter: long enough to show a training block, short enough to stay
 *  sensitive to recent progress. */
export const DEFAULT_PERIOD: PeriodKey = "3m";

export function isPeriodKey(value: unknown): value is PeriodKey {
  return (
    typeof value === "string" &&
    (PERIOD_KEYS as readonly string[]).includes(value)
  );
}

function periodStartDate(period: PeriodKey, today: Date): Date | null {
  switch (period) {
    case "1m":
      return addDays(subMonths(today, 1), 1);
    case "3m":
      return addDays(subMonths(today, 3), 1);
    case "6m":
      return addDays(subMonths(today, 6), 1);
    case "1y":
      return addDays(subYears(today, 1), 1);
    case "all":
      return null;
  }
}

/** Inclusive ISO start of a period that ends today; null means all time. */
export function periodStart(
  period: PeriodKey,
  today: Date = new Date(),
): string | null {
  const start = periodStartDate(period, today);
  return start ? toISODate(start) : null;
}

/** The equally long window right before the current one, for "vs previous"
 *  deltas. All-time has no previous window. */
export function previousPeriodRange(
  period: PeriodKey,
  today: Date = new Date(),
): { from: string; to: string } | null {
  const start = periodStartDate(period, today);
  if (!start) return null;
  const end = addDays(start, -1);
  const previousStart = periodStartDate(period, end);
  return previousStart
    ? { from: toISODate(previousStart), to: toISODate(end) }
    : null;
}

/** Items whose ISO `date` falls inside the period (inclusive). */
export function filterByPeriod<T extends { date: string }>(
  items: T[],
  period: PeriodKey,
  today: Date = new Date(),
): T[] {
  const from = periodStart(period, today);
  return from ? items.filter((item) => item.date >= from) : items;
}

/** One viewer-wide choice shared by every chart, so picking "All" on the
 *  Progress page also applies to the home widget. */
export const usePreferredPeriod = createStoredPreference<PeriodKey>(
  "deepgym-chart-period",
  DEFAULT_PERIOD,
  isPeriodKey,
);
