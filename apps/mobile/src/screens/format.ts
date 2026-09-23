import type { Workout } from "@deepgym/core/types";
import {
  weekStreak as coreWeekStreak,
  weeklyBuckets,
  workoutSetCount,
  workoutVolumeKg as coreWorkoutVolumeKg,
} from "@deepgym/core/analytics";

/** Local calendar dates must never be derived from UTC ISO timestamps. */
export function localISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromISO(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(value: string, locale = "en"): string {
  return fromISO(value).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function workingSetCount(workout: Workout): number {
  return workoutSetCount(workout);
}

export function workoutVolumeKg(workout: Workout): number {
  return coreWorkoutVolumeKg(workout);
}

export function currentWeekCount(workouts: Workout[], today = new Date()): number {
  return weeklyBuckets(workouts, 1, today)[0]?.workouts ?? 0;
}

export function weekStreak(workouts: Workout[], today = new Date()): number {
  return coreWeekStreak(workouts.map((workout) => workout.date), today);
}
