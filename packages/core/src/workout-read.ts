import type { SupabaseClient } from "@supabase/supabase-js";
import { readAllPages, readIdBatches } from "./pagination";
import type { Workout, WorkoutExercise, WorkoutSet } from "./types";

export type WorkoutHeader = Omit<Workout, "workout_exercises">;

/** Paginate children independently: embedded to-many results can themselves
 * be capped by PostgREST, even when the parent page contains one workout. */
export async function hydrateWorkouts(supabase: SupabaseClient, headers: WorkoutHeader[], signal: AbortSignal): Promise<Workout[]> {
  const occurrences = await readIdBatches<Omit<WorkoutExercise, "sets">>(
    headers.map((workout) => workout.id),
    (ids) => readAllPages(async ({ from, to, count }) => {
      const result = await supabase.from("workout_exercises")
        .select("*,exercise:exercises(*)", { count })
        .in("workout_id", ids).order("id").range(from, to).abortSignal(signal);
      return { ...result, data: result.data as unknown as Omit<WorkoutExercise, "sets">[] | null };
    }, signal),
  );
  const sets = await readIdBatches<WorkoutSet>(
    occurrences.map((occurrence) => occurrence.id),
    (ids) => readAllPages(async ({ from, to, count }) => {
      const result = await supabase.from("sets")
        .select("*", { count })
        .in("workout_exercise_id", ids).order("id").range(from, to).abortSignal(signal);
      return { ...result, data: result.data as WorkoutSet[] | null };
    }, signal),
  );
  const byOccurrence = new Map<string, WorkoutSet[]>();
  for (const set of sets) {
    const list = byOccurrence.get(set.workout_exercise_id) ?? [];
    list.push(set);
    byOccurrence.set(set.workout_exercise_id, list);
  }
  const byWorkout = new Map<string, WorkoutExercise[]>();
  for (const occurrence of occurrences) {
    const list = byWorkout.get(occurrence.workout_id) ?? [];
    list.push({ ...occurrence, sets: (byOccurrence.get(occurrence.id) ?? []).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)) });
    byWorkout.set(occurrence.workout_id, list);
  }
  return headers.map((workout) => ({
    ...workout,
    workout_exercises: (byWorkout.get(workout.id) ?? []).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
  }));
}

export async function fetchWorkouts(supabase: SupabaseClient, ownerId: string, signal: AbortSignal, dates?: { from: string; to: string }) {
  const headers = await readAllPages<WorkoutHeader>(async ({ from, to, count }) => {
    let query = supabase.from("workouts").select("*", { count }).eq("user_id", ownerId);
    if (dates) query = query.gte("date", dates.from).lte("date", dates.to);
    const result = await query.order("date", { ascending: false }).order("created_at", { ascending: false })
      .order("id", { ascending: false }).range(from, to).abortSignal(signal);
    return { ...result, data: result.data as WorkoutHeader[] | null };
  }, signal);
  return hydrateWorkouts(supabase, headers, signal);
}

export async function fetchWorkout(supabase: SupabaseClient, ownerId: string, id: string, signal: AbortSignal): Promise<Workout> {
  const { data, error } = await supabase.from("workouts").select("*")
    .eq("id", id).eq("user_id", ownerId).abortSignal(signal).single();
  if (error) throw error;
  // The self-hosted detail operation returns all children in one transaction.
  if (Array.isArray(data.workout_exercises)) return data as Workout;
  return (await hydrateWorkouts(supabase, [data as WorkoutHeader], signal))[0];
}
