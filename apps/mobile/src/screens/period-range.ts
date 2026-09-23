import { localISO } from "./format";

export type LookbackPeriod = "1m" | "3m" | "6m" | "1y" | "all";

function clampedLookbackDate(period: LookbackPeriod, today: Date): Date | null {
  if (period === "all") return null;
  const months = period === "1m" ? 1 : period === "3m" ? 3 : period === "6m" ? 6 : 12;
  const targetMonth = new Date(today.getFullYear(), today.getMonth() - months, 1);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  const start = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(today.getDate(), lastDay));
  // The PWA's date-fns period range starts one day after the clamped lookback date.
  start.setDate(start.getDate() + 1);
  return start;
}

export function lookbackStart(period: LookbackPeriod, today: Date = new Date()): string | null {
  const start = clampedLookbackDate(period, today);
  return start ? localISO(start) : null;
}

export function previousLookbackRange(period: LookbackPeriod, today: Date = new Date()): { from: string; to: string } | null {
  const currentStart = clampedLookbackDate(period, today);
  if (!currentStart) return null;
  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = clampedLookbackDate(period, previousEnd);
  return previousStart ? { from: localISO(previousStart), to: localISO(previousEnd) } : null;
}

export function calendarDaysSince(since: string, today: Date = new Date()): number {
  const [year, month, day] = since.split("-").map(Number);
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(year, month - 1, day);
  return Math.max(1, Math.round((a - b) / 86_400_000) + 1);
}

export function calendarWeeksSince(firstDate: string | null, today: Date = new Date()): number {
  if (!firstDate) return 12;
  const [year, month, day] = firstDate.split("-").map(Number);
  const first = Date.UTC(year, month - 1, day);
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const firstWeek = first - ((new Date(first).getUTCDay() + 6) % 7) * 86_400_000;
  const currentWeek = current - ((new Date(current).getUTCDay() + 6) % 7) * 86_400_000;
  return Math.min(52, Math.max(4, Math.round((currentWeek - firstWeek) / (7 * 86_400_000)) + 1));
}
