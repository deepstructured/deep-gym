import { addDays, differenceInCalendarDays } from "date-fns";
import {
  normalizeTrainingSchedule,
  type TrainingSchedule,
} from "@/entities/user";
import { fromISODate, toISODate } from "@/shared/lib/dates";

export interface ScheduledWorkout {
  /** ISO date of the scheduled session. */
  date: string;
  /** 0 = today, 1 = tomorrow, … */
  daysAway: number;
  /** User-selected workout type, e.g. "Upper". */
  type: string;
}

/** Weekday with Monday = 0. */
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** The next session from the user's explicit weekly schedule. If today's
 *  scheduled session is already logged, continue to the next scheduled day. */
export function nextScheduledWorkout(
  schedule: TrainingSchedule | null | undefined,
  workouts: { date: string }[],
  today: Date = new Date(),
): ScheduledWorkout | null {
  const week = normalizeTrainingSchedule(schedule);
  const isoToday = toISODate(today);
  const trainedToday = workouts.some((workout) => workout.date === isoToday);

  for (let offset = 0; offset <= 7; offset++) {
    if (offset === 0 && trainedToday) continue;
    const candidate = addDays(today, offset);
    const type = week[weekdayIndex(candidate)];
    if (type) {
      return { date: toISODate(candidate), daysAway: offset, type };
    }
  }
  return null;
}

/** A scheduled session on one selected date. The current schedule only
 *  applies to today and the future; it does not rewrite past history. */
export function scheduledWorkoutOn(
  schedule: TrainingSchedule | null | undefined,
  dateISO: string,
  today: Date = new Date(),
): ScheduledWorkout | null {
  if (dateISO < toISODate(today)) return null;

  const date = fromISODate(dateISO);
  const type = normalizeTrainingSchedule(schedule)[weekdayIndex(date)];
  if (!type) return null;

  return {
    date: dateISO,
    daysAway: differenceInCalendarDays(date, today),
    type,
  };
}
