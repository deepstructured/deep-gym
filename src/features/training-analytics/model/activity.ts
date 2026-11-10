import { addDays, differenceInCalendarDays, differenceInCalendarWeeks, startOfWeek } from "date-fns";
import type { WorkoutActivity } from "@/entities/workout";
import { fromISODate, toISODate } from "@/shared/lib/dates";
import type { PeriodTotals, WeekBucket } from "./analytics";

export function activityWeeklyBuckets(rows: WorkoutActivity[], weeks: number, today = new Date()): WeekBucket[] {
  const currentStart = startOfWeek(today, { weekStartsOn: 1 });
  const buckets = Array.from({ length: weeks }, (_, index) => ({
    start: toISODate(addDays(currentStart, (index - weeks + 1) * 7)),
    workouts: 0, sets: 0, volumeKg: 0,
  }));
  for (const row of rows) {
    const index = weeks - 1 - differenceInCalendarWeeks(currentStart, fromISODate(row.date), { weekStartsOn: 1 });
    if (index < 0 || index >= weeks) continue;
    buckets[index].workouts++;
    buckets[index].sets += row.sets;
    buckets[index].volumeKg += row.volumeKg;
  }
  return buckets;
}

export function activityPeriodTotals(rows: WorkoutActivity[], spanDays?: number): PeriodTotals {
  const dates = [...new Set(rows.map((row) => row.date))].sort();
  const span = spanDays ?? (dates.length ? differenceInCalendarDays(new Date(), fromISODate(dates[0])) + 1 : 7);
  return {
    workouts: rows.length,
    sets: rows.reduce((sum, row) => sum + row.sets, 0),
    reps: rows.reduce((sum, row) => sum + row.reps, 0),
    volumeKg: rows.reduce((sum, row) => sum + row.volumeKg, 0),
    days: dates.length,
    perWeek: Math.round((rows.length / (Math.max(span, 7) / 7)) * 10) / 10,
  };
}
