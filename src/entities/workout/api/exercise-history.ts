"use client";

import { useQuery } from "@tanstack/react-query";
import type { SetType } from "@/shared/config/workout";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";

export interface ExerciseSetRecord {
  weight_kg: number | null;
  /** Athlete body-weight captured on the parent workout. Null for legacy
   * workouts logged before body-weight snapshots were introduced. */
  body_weight_kg: number | null;
  reps: number | null;
  to_failure: boolean;
  /** Warm-ups are shown in history but excluded from statistics. */
  set_type: SetType;
  position: number;
  workoutId: string;
  workoutDate: string;
  workoutType: string;
  exerciseNotes: string | null;
}

interface RawRow {
  weight_kg: number | null;
  reps: number | null;
  to_failure: boolean;
  set_type?: SetType;
  position: number;
  workout_exercise: {
    exercise_id: string;
    notes: string | null;
    workout: {
      id: string;
      date: string;
      type: string;
      body_weight_kg: number | null;
    };
  };
}

/** Every logged set (warm-ups included) of one exercise across all
 *  workouts, oldest first. */
export function useExerciseHistory(exerciseId: string) {
  return useQuery({
    queryKey: ["exercise-history", exerciseId],
    queryFn: async (): Promise<ExerciseSetRecord[]> => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("sets")
        // `*` rather than an explicit column list: set_type only exists once
        // migration 0008 has been applied.
        .select(
          `*,
           workout_exercise:workout_exercises!inner (
             exercise_id, notes,
             workout:workouts!inner (id, date, type, body_weight_kg)
           )`,
        )
        .eq("workout_exercise.exercise_id", exerciseId);
      if (error) throw error;

      const rows = (data as unknown as RawRow[]).map(
        (row): ExerciseSetRecord => ({
          weight_kg: row.weight_kg,
          body_weight_kg: row.workout_exercise.workout.body_weight_kg,
          reps: row.reps,
          to_failure: row.to_failure,
          set_type: row.set_type === "warmup" ? "warmup" : "working",
          position: row.position,
          workoutId: row.workout_exercise.workout.id,
          workoutDate: row.workout_exercise.workout.date,
          workoutType: row.workout_exercise.workout.type,
          exerciseNotes: row.workout_exercise.notes,
        }),
      );

      rows.sort(
        (a, b) =>
          a.workoutDate.localeCompare(b.workoutDate) || a.position - b.position,
      );
      return rows;
    },
    enabled: Boolean(exerciseId),
  });
}
