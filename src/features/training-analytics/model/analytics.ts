import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  startOfWeek,
} from "date-fns";
import type { Workout, WorkoutExercise, WorkoutSet } from "@/entities/workout";
import { isWarmupSet } from "@/shared/config/workout";
import { fromISODate, toISODate } from "@/shared/lib/dates";

/** Warm-ups never count toward any aggregate. */
export function workingSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((set) => !isWarmupSet(set));
}

/** Weight × reps over working sets. Bodyweight occurrences are skipped:
 *  their stored load includes body mass and would dwarf external volume. */
export function exerciseVolumeKg(we: WorkoutExercise): number {
  if (we.load_mode === "bodyweight") return 0;
  return workingSets(we.sets).reduce(
    (sum, set) =>
      set.weight_kg != null && set.reps != null
        ? sum + set.weight_kg * set.reps
        : sum,
    0,
  );
}

export function workoutVolumeKg(workout: Workout): number {
  return workout.workout_exercises.reduce(
    (sum, we) => sum + exerciseVolumeKg(we),
    0,
  );
}

export function workoutSetCount(workout: Workout): number {
  return workout.workout_exercises.reduce(
    (sum, we) => sum + workingSets(we.sets).length,
    0,
  );
}

/** Workouts whose date is inside [from, to] (inclusive; null = open). */
export function workoutsBetween(
  workouts: Workout[],
  from: string | null,
  to: string | null = null,
): Workout[] {
  return workouts.filter(
    (workout) =>
      (from == null || workout.date >= from) &&
      (to == null || workout.date <= to),
  );
}

export interface PeriodTotals {
  workouts: number;
  sets: number;
  reps: number;
  volumeKg: number;
  /** Distinct training days. */
  days: number;
  /** Average sessions per week over the window. */
  perWeek: number;
}

/** Totals over a list of workouts. `spanDays` is the window length used for
 *  the weekly average (defaults to the span of the workouts themselves). */
export function periodTotals(
  workouts: Workout[],
  spanDays?: number,
): PeriodTotals {
  let sets = 0;
  let reps = 0;
  let volumeKg = 0;
  for (const workout of workouts) {
    for (const we of workout.workout_exercises) {
      const working = workingSets(we.sets);
      sets += working.length;
      reps += working.reduce((sum, set) => sum + (set.reps ?? 0), 0);
      volumeKg += exerciseVolumeKg(we);
    }
  }
  const dates = [...new Set(workouts.map((workout) => workout.date))].sort();
  const span =
    spanDays ??
    (dates.length
      ? differenceInCalendarDays(new Date(), fromISODate(dates[0])) + 1
      : 7);
  return {
    workouts: workouts.length,
    sets,
    reps,
    volumeKg,
    days: dates.length,
    perWeek:
      Math.round((workouts.length / (Math.max(span, 7) / 7)) * 10) / 10,
  };
}

export interface WeekBucket {
  /** ISO Monday of the week. */
  start: string;
  workouts: number;
  sets: number;
  volumeKg: number;
}

/** The last `weeks` calendar weeks (Monday-based), oldest first; the last
 *  bucket is the current week. */
export function weeklyBuckets(
  workouts: Workout[],
  weeks: number,
  today: Date = new Date(),
): WeekBucket[] {
  const currentStart = startOfWeek(today, { weekStartsOn: 1 });
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, index) => ({
    start: toISODate(addDays(currentStart, (index - weeks + 1) * 7)),
    workouts: 0,
    sets: 0,
    volumeKg: 0,
  }));
  for (const workout of workouts) {
    const offset = differenceInCalendarWeeks(
      currentStart,
      fromISODate(workout.date),
      { weekStartsOn: 1 },
    );
    const index = weeks - 1 - offset;
    if (index < 0 || index >= weeks) continue;
    buckets[index].workouts += 1;
    buckets[index].sets += workoutSetCount(workout);
    buckets[index].volumeKg += workoutVolumeKg(workout);
  }
  return buckets;
}

/** Consecutive weeks (incl. this one) with at least one workout. A streak
 *  may also run up to last week while this week is still empty. */
export function weekStreak(dates: string[], today: Date = new Date()): number {
  if (dates.length === 0) return 0;
  const weeks = new Set(
    dates.map((date) =>
      differenceInCalendarWeeks(today, fromISODate(date), { weekStartsOn: 1 }),
    ),
  );
  let streak = 0;
  let week = weeks.has(0) ? 0 : 1;
  while (weeks.has(week)) {
    streak++;
    week++;
  }
  return streak;
}

/** Number of workouts per ISO date. */
export function activityByDate(workouts: Workout[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const workout of workouts) {
    map.set(workout.date, (map.get(workout.date) ?? 0) + 1);
  }
  return map;
}

export type RecordKind = "weight" | "oneRm" | "reps";

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  /** Per-exercise display unit override. */
  exerciseUnit: "kg" | "lb" | null;
  date: string;
  kind: RecordKind;
  /** kg for weight/1RM, a count for reps. */
  value: number;
  previous: number;
}

/**
 * Sessions that beat an exercise's earlier best: heaviest working set, else
 * estimated 1RM (external load), or most reps in a set (bodyweight). The
 * first session of an exercise is only a baseline. Newest first.
 */
export function personalRecords(
  workouts: Workout[],
  since: string | null = null,
): PersonalRecord[] {
  const chronological = [...workouts].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at),
  );
  const best = new Map<
    string,
    { weight: number; oneRm: number; reps: number }
  >();
  const records: PersonalRecord[] = [];

  for (const workout of chronological) {
    for (const we of workout.workout_exercises) {
      const sets = workingSets(we.sets);
      if (sets.length === 0) continue;
      const bodyweight = we.load_mode === "bodyweight";
      let weight = -Infinity;
      let oneRm = -Infinity;
      let reps = -Infinity;
      for (const set of sets) {
        if (set.reps != null) reps = Math.max(reps, set.reps);
        if (bodyweight || set.weight_kg == null) continue;
        weight = Math.max(weight, set.weight_kg);
        if (set.reps != null && set.reps > 0) {
          oneRm = Math.max(oneRm, set.weight_kg * (1 + set.reps / 30));
        }
      }

      const previous = best.get(we.exercise_id);
      if (previous && (since == null || workout.date >= since)) {
        const base = {
          exerciseId: we.exercise_id,
          exerciseName: we.exercise?.name ?? "",
          exerciseUnit: we.exercise?.unit ?? null,
          date: workout.date,
        };
        // At most one record per exercise and session: a heavier top set
        // wins; an estimated-1RM record only shows when the weight did not.
        const record =
          bodyweight
            ? reps > previous.reps && Number.isFinite(previous.reps)
              ? { kind: "reps" as const, value: reps, previous: previous.reps }
              : null
            : weight > previous.weight + 1e-9 &&
                Number.isFinite(previous.weight)
              ? {
                  kind: "weight" as const,
                  value: weight,
                  previous: previous.weight,
                }
              : oneRm > previous.oneRm + 0.05 &&
                  Number.isFinite(previous.oneRm)
                ? {
                    kind: "oneRm" as const,
                    value: oneRm,
                    previous: previous.oneRm,
                  }
                : null;
        if (record) records.push({ ...base, ...record });
      }
      best.set(we.exercise_id, {
        weight: Math.max(previous?.weight ?? -Infinity, weight),
        oneRm: Math.max(previous?.oneRm ?? -Infinity, oneRm),
        reps: Math.max(previous?.reps ?? -Infinity, reps),
      });
    }
  }
  return records.reverse();
}

/** Working sets per muscle group id. */
export function setsByMuscleGroup(workouts: Workout[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const workout of workouts) {
    for (const we of workout.workout_exercises) {
      const groupId = we.exercise?.muscle_group_id;
      if (!groupId) continue;
      const count = workingSets(we.sets).length;
      if (count === 0) continue;
      map.set(groupId, (map.get(groupId) ?? 0) + count);
    }
  }
  return map;
}

export interface BestLift {
  exerciseId: string;
  exerciseName: string;
  exerciseUnit: "kg" | "lb" | null;
  oneRmKg: number;
  weightKg: number;
  reps: number;
  date: string;
}

/** Strongest lifts by estimated 1RM (external load only). */
export function bestLifts(workouts: Workout[], limit = 3): BestLift[] {
  const byExercise = new Map<string, BestLift>();
  for (const workout of workouts) {
    for (const we of workout.workout_exercises) {
      if (we.load_mode === "bodyweight") continue;
      for (const set of workingSets(we.sets)) {
        if (set.weight_kg == null || set.reps == null || set.reps <= 0) {
          continue;
        }
        const oneRmKg = set.weight_kg * (1 + set.reps / 30);
        const current = byExercise.get(we.exercise_id);
        if (!current || oneRmKg > current.oneRmKg) {
          byExercise.set(we.exercise_id, {
            exerciseId: we.exercise_id,
            exerciseName: we.exercise?.name ?? "",
            exerciseUnit: we.exercise?.unit ?? null,
            oneRmKg,
            weightKg: set.weight_kg,
            reps: set.reps,
            date: workout.date,
          });
        }
      }
    }
  }
  return [...byExercise.values()]
    .sort((a, b) => b.oneRmKg - a.oneRmKg)
    .slice(0, limit);
}

/** Relative change in percent; null when there is no baseline. */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

/** Workouts narrowed to one muscle group's exercises; workouts without any
 *  of them drop out. Null keeps everything. */
export function workoutsForGroup(
  workouts: Workout[],
  groupId: string | null,
): Workout[] {
  if (!groupId) return workouts;
  return workouts.flatMap((workout) => {
    const exercises = workout.workout_exercises.filter(
      (we) => we.exercise?.muscle_group_id === groupId,
    );
    return exercises.length > 0
      ? [{ ...workout, workout_exercises: exercises }]
      : [];
  });
}
