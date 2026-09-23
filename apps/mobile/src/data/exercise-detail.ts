import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Exercise, Workout } from "@deepgym/core/types";
import type { SetType } from "@deepgym/core/workout";
import { roundWeight } from "@deepgym/core/weight";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/auth-provider";

export interface ExerciseSetRecord {
  weight_kg: number | null;
  body_weight_kg: number | null;
  reps: number | null;
  to_failure: boolean;
  set_type: SetType;
  position: number;
  workoutId: string;
  workoutDate: string;
  workoutType: string;
  exerciseNotes: string | null;
}

/** The same ordered set history displayed by the web exercise detail view. */
export function exerciseHistory(workouts: Workout[], exerciseId: string): ExerciseSetRecord[] {
  const records: ExerciseSetRecord[] = [];
  for (const workout of workouts) {
    for (const occurrence of workout.workout_exercises) {
      if (occurrence.exercise_id !== exerciseId) continue;
      for (const set of occurrence.sets) {
        records.push({
          weight_kg: set.weight_kg,
          body_weight_kg: workout.body_weight_kg,
          reps: set.reps,
          to_failure: set.to_failure,
          set_type: set.set_type === "warmup" ? "warmup" : "working",
          position: set.position,
          workoutId: workout.id,
          workoutDate: workout.date,
          workoutType: workout.type,
          exerciseNotes: occurrence.notes,
        });
      }
    }
  }
  return records.sort(
    (a, b) => a.workoutDate.localeCompare(b.workoutDate) || a.position - b.position,
  );
}

function workingRecords(records: ExerciseSetRecord[]): ExerciseSetRecord[] {
  return records.filter((record) => record.set_type !== "warmup");
}

function addedLoadKg(record: ExerciseSetRecord): number | null {
  return record.weight_kg != null && record.body_weight_kg != null
    ? record.weight_kg - record.body_weight_kg
    : null;
}

export interface ExerciseSummary {
  sessions: number;
  totalSets: number;
  totalReps: number;
  bestWeightKg: number | null;
  bestAddedLoadKg: number | null;
  estOneRepMaxKg: number | null;
}

export function exerciseSummary(records: ExerciseSetRecord[], bodyweight: boolean): ExerciseSummary {
  const working = workingRecords(records);
  const weighted = bodyweight ? [] : working.filter((record) => record.weight_kg != null);
  const added = bodyweight
    ? working.map(addedLoadKg).filter((value): value is number => value != null)
    : [];
  let oneRepMax: number | null = null;
  for (const record of weighted) {
    if (record.reps == null || record.reps <= 0) continue;
    const estimate = record.weight_kg! * (1 + record.reps / 30);
    if (oneRepMax == null || estimate > oneRepMax) oneRepMax = estimate;
  }
  return {
    sessions: new Set(working.map((record) => record.workoutDate)).size,
    totalSets: working.length,
    totalReps: working.reduce((sum, record) => sum + (record.reps ?? 0), 0),
    bestWeightKg: weighted.length ? Math.max(...weighted.map((record) => record.weight_kg!)) : null,
    bestAddedLoadKg: added.length ? Math.max(...added) : null,
    estOneRepMaxKg: oneRepMax == null ? null : roundWeight(oneRepMax),
  };
}

export interface RepsByWeight {
  weightKg: number;
  setCount: number;
  avgReps: number;
  medianReps: number;
  modeReps: number;
  failureRate: number;
}

export function repsByWeight(records: ExerciseSetRecord[], bodyweight: boolean): RepsByWeight[] {
  const groups = new Map<number, ExerciseSetRecord[]>();
  for (const record of workingRecords(records)) {
    if (record.reps == null) continue;
    const load = bodyweight ? addedLoadKg(record) : record.weight_kg;
    if (load == null) continue;
    const key = roundWeight(load);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups].map(([weightKg, sets]) => {
    const reps = sets.map((set) => set.reps!).sort((a, b) => a - b);
    const mid = Math.floor(reps.length / 2);
    const counts = new Map<number, number>();
    let modeReps = reps[0];
    let modeCount = 0;
    for (const rep of reps) {
      const count = (counts.get(rep) ?? 0) + 1;
      counts.set(rep, count);
      if (count > modeCount || (count === modeCount && rep > modeReps)) {
        modeReps = rep;
        modeCount = count;
      }
    }
    return {
      weightKg,
      setCount: sets.length,
      avgReps: roundWeight(reps.reduce((sum, rep) => sum + rep, 0) / reps.length),
      medianReps: reps.length % 2 ? reps[mid] : (reps[mid - 1] + reps[mid]) / 2,
      modeReps,
      failureRate: sets.filter((set) => set.to_failure).length / sets.length,
    };
  }).sort((a, b) => b.weightKg - a.weightKg);
}

export type ProgressMetric = "topSet" | "oneRm" | "volume" | "reps" | "addedLoad";

export interface ProgressPoint {
  date: string;
  value: number;
  sets: number;
  reps: number;
}

/** One value per calendar date, oldest first; warm-ups never enter the series. */
export function exerciseProgress(records: ExerciseSetRecord[], metric: ProgressMetric): ProgressPoint[] {
  const byDate = new Map<string, ExerciseSetRecord[]>();
  for (const record of workingRecords(records)) {
    const day = byDate.get(record.workoutDate) ?? [];
    day.push(record);
    byDate.set(record.workoutDate, day);
  }
  const points: ProgressPoint[] = [];
  for (const [date, sets] of byDate) {
    let value: number | null = null;
    for (const set of sets) {
      if (metric === "topSet" && set.weight_kg != null) {
        value = Math.max(value ?? -Infinity, set.weight_kg);
      } else if (metric === "oneRm" && set.weight_kg != null && set.reps != null && set.reps > 0) {
        value = Math.max(value ?? -Infinity, set.weight_kg * (1 + set.reps / 30));
      } else if (metric === "volume" && set.weight_kg != null && set.reps != null) {
        value = (value ?? 0) + set.weight_kg * set.reps;
      } else if (metric === "reps" && set.reps != null) {
        value = (value ?? 0) + set.reps;
      } else if (metric === "addedLoad") {
        const added = addedLoadKg(set);
        if (added != null) value = Math.max(value ?? -Infinity, added);
      }
    }
    if (value != null && Number.isFinite(value)) {
      points.push({
        date,
        value,
        sets: sets.length,
        reps: sets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
      });
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export type ExerciseEditPatch = Partial<Pick<
  Exercise,
  "name" | "muscle_group_id" | "equipment" | "machine_settings" | "unit" | "working_weight_kg"
>>;

export function useUpdateExerciseDetail() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ExerciseEditPatch }): Promise<Exercise> => {
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("exercises")
        .update(patch)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Exercise;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Exercise[]>(["exercises", user?.id], (current) =>
        current?.map((exercise) => exercise.id === updated.id ? updated : exercise),
      );
      queryClient.invalidateQueries({ queryKey: ["exercises", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["workouts", user?.id] });
    },
  });
}
