"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";

export interface ExerciseSetRecord {
  weight_kg: number | null;
  reps: number | null;
  to_failure: boolean;
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
  position: number;
  workout_exercise: {
    exercise_id: string;
    notes: string | null;
    workout: { id: string; date: string; type: string };
  };
}

/** Every logged set of one exercise across all workouts, oldest first. */
export function useExerciseHistory(exerciseId: string) {
  return useQuery({
    queryKey: ["exercise-history", exerciseId],
    queryFn: async (): Promise<ExerciseSetRecord[]> => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("sets")
        .select(
          `weight_kg, reps, to_failure, position,
           workout_exercise:workout_exercises!inner (
             exercise_id, notes,
             workout:workouts!inner (id, date, type)
           )`,
        )
        .eq("workout_exercise.exercise_id", exerciseId);
      if (error) throw error;

      const rows = (data as unknown as RawRow[]).map((row) => ({
        weight_kg: row.weight_kg,
        reps: row.reps,
        to_failure: row.to_failure,
        position: row.position,
        workoutId: row.workout_exercise.workout.id,
        workoutDate: row.workout_exercise.workout.date,
        workoutType: row.workout_exercise.workout.type,
        exerciseNotes: row.workout_exercise.notes,
      }));

      rows.sort(
        (a, b) =>
          a.workoutDate.localeCompare(b.workoutDate) || a.position - b.position,
      );
      return rows;
    },
    enabled: Boolean(exerciseId),
  });
}
