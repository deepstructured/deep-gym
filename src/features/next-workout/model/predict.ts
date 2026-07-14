import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
} from "date-fns";
import { fromISODate, toISODate } from "@/shared/lib/dates";

export interface NextWorkoutPrediction {
  /** ISO date of the predicted session. */
  date: string;
  /** 0 = today, 1 = tomorrow, … */
  daysAway: number;
  /** Predicted workout type, e.g. "Upper". */
  type: string;
}

/** How far back to look for a repeating weekly pattern. */
const WINDOW_DAYS = 28;

/** Weekday with Monday = 0 (matches the rest of the app). */
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Guess the next session from the user's weekly rhythm: if a weekday keeps
 * showing up in recent weeks (Tue = Upper, Thu = Lower, …), the nearest such
 * weekday without a logged workout is the prediction. Returns null until
 * there's at least one full week of history or no weekday repeats.
 */
export function predictNextWorkout(
  workouts: { date: string; type: string }[],
  today: Date = new Date(),
): NextWorkoutPrediction | null {
  const isoToday = toISODate(today);
  const windowStart = toISODate(addDays(today, -WINDOW_DAYS));
  const recent = workouts.filter(
    (w) => w.date >= windowStart && w.date <= isoToday,
  );
  if (recent.length === 0) return null;

  // One full week of history is the minimum before guessing a schedule.
  const oldest = recent.reduce(
    (min, w) => (w.date < min ? w.date : min),
    recent[0].date,
  );
  if (differenceInCalendarDays(today, fromISODate(oldest)) < 7) return null;

  const weeksWithData = new Set<number>();
  const byWeekday = new Map<
    number,
    { weeks: Set<number>; types: Map<string, { count: number; last: string }> }
  >();

  for (const workout of recent) {
    const date = fromISODate(workout.date);
    const week = differenceInCalendarWeeks(today, date, { weekStartsOn: 1 });
    weeksWithData.add(week);

    const weekday = weekdayIndex(date);
    let entry = byWeekday.get(weekday);
    if (!entry) {
      entry = { weeks: new Set(), types: new Map() };
      byWeekday.set(weekday, entry);
    }
    entry.weeks.add(week);

    const typeInfo = entry.types.get(workout.type) ?? {
      count: 0,
      last: workout.date,
    };
    typeInfo.count += 1;
    if (workout.date > typeInfo.last) typeInfo.last = workout.date;
    entry.types.set(workout.type, typeInfo);
  }

  // A weekday counts as scheduled when it repeats across weeks; with only
  // 1–2 weeks of history a single occurrence is enough.
  const minWeeks = weeksWithData.size >= 3 ? 2 : 1;
  const schedule = new Map<number, string>();
  for (const [weekday, entry] of byWeekday) {
    if (entry.weeks.size < minWeeks) continue;
    // Most frequent type on that weekday; ties go to the most recent one.
    let best: string | null = null;
    let bestCount = -1;
    let bestLast = "";
    for (const [type, info] of entry.types) {
      if (
        info.count > bestCount ||
        (info.count === bestCount && info.last > bestLast)
      ) {
        best = type;
        bestCount = info.count;
        bestLast = info.last;
      }
    }
    if (best) schedule.set(weekday, best);
  }
  if (schedule.size === 0) return null;

  const trainedToday = recent.some((w) => w.date === isoToday);
  for (let offset = 0; offset <= 7; offset++) {
    if (offset === 0 && trainedToday) continue;
    const candidate = addDays(today, offset);
    const type = schedule.get(weekdayIndex(candidate));
    if (type) {
      return { date: toISODate(candidate), daysAway: offset, type };
    }
  }
  return null;
}
