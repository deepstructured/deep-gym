"use client";

import { useQuery } from "@tanstack/react-query";
import type { SetType } from "@/shared/config/workout";
import { useAuthSession } from "@/shared/lib/auth-session";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { readAllPages } from "@/shared/lib/supabase/pagination";

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

interface RawRow {
  id: string;
  weight_kg: number | null;
  reps: number | null;
  to_failure: boolean;
  set_type: SetType;
  position: number;
  workout_exercise: {
    exercise_id: string;
    notes: string | null;
    workout: { id: string; date: string; created_at: string; type: string; body_weight_kg: number | null };
  };
}

const SELECT = `id,weight_kg,reps,to_failure,set_type,position,
  workout_exercise:workout_exercises!inner (
    exercise_id,notes,workout_id,
    workout:workouts!inner (id,date,created_at,type,body_weight_kg,user_id)
  )`;

async function readHistory(userId: string, exerciseId: string, signal: AbortSignal, workoutId?: string) {
  const rows = await readAllPages<RawRow>(async (page) => {
    let query = getSupabaseBrowser().from("sets").select(SELECT, { count: page.count })
      .eq("workout_exercise.exercise_id", exerciseId)
      .eq("workout_exercise.workout.user_id", userId);
    if (workoutId) query = query.eq("workout_exercise.workout_id", workoutId);
    const result = await query.order("id").range(page.from, page.to).abortSignal(signal);
    return { ...result, data: result.data as unknown as RawRow[] | null };
  }, signal);
  rows.sort((a, b) => a.workout_exercise.workout.date.localeCompare(b.workout_exercise.workout.date)
    || a.workout_exercise.workout.created_at.localeCompare(b.workout_exercise.workout.created_at)
    || a.workout_exercise.workout.id.localeCompare(b.workout_exercise.workout.id)
    || a.position - b.position || a.id.localeCompare(b.id));
  return rows.map((row): ExerciseSetRecord => ({
    weight_kg: row.weight_kg, body_weight_kg: row.workout_exercise.workout.body_weight_kg,
    reps: row.reps, to_failure: row.to_failure, set_type: row.set_type,
    position: row.position, workoutId: row.workout_exercise.workout.id,
    workoutDate: row.workout_exercise.workout.date, workoutType: row.workout_exercise.workout.type,
    exerciseNotes: row.workout_exercise.notes,
  }));
}

/** Complete, deterministically ordered history, including warm-ups. */
export function useExerciseHistory(exerciseId: string) {
  const { userId, status } = useAuthSession();
  return useQuery({
    queryKey: ["exercise-history", userId, exerciseId],
    queryFn: ({ signal }) => readHistory(userId!, exerciseId, signal),
    enabled: status === "authenticated" && Boolean(exerciseId),
  });
}

/** The form needs one earlier session, not the exercise's entire history. */
export function usePreviousExerciseSets(exerciseId: string, beforeDate: string) {
  const { userId, status } = useAuthSession();
  return useQuery({
    queryKey: ["exercise-history", "previous", userId, exerciseId, beforeDate],
    queryFn: async ({ signal }): Promise<ExerciseSetRecord[]> => {
      const { data, error } = await getSupabaseBrowser().from("workouts")
        .select("id,workout_exercises!inner(id)")
        .eq("user_id", userId!).eq("workout_exercises.exercise_id", exerciseId).lt("date", beforeDate)
        .order("date", { ascending: false }).order("created_at", { ascending: false })
        .order("id", { ascending: false }).limit(1).abortSignal(signal);
      if (error) throw error;
      return data?.[0] ? readHistory(userId!, exerciseId, signal, data[0].id) : [];
    },
    enabled: status === "authenticated" && Boolean(exerciseId && beforeDate),
  });
}
