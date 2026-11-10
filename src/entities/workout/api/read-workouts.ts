import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { readAllPages, readIdBatches } from "@/shared/lib/supabase/pagination";
import type { Workout, WorkoutExercise, WorkoutSet } from "../model/types";

export const WORKOUT_FIELDS = "id,user_id,type,date,notes,body_weight_kg,created_at";
export type WorkoutHeader = Omit<Workout, "workout_exercises">;

/** Paginate children independently: embedded to-many results can themselves
 * be capped by PostgREST, even when the parent page contains one workout. */
export async function hydrateWorkouts(headers: WorkoutHeader[], signal: AbortSignal): Promise<Workout[]> {
  const supabase = getSupabaseBrowser();
  const occurrences = await readIdBatches<Omit<WorkoutExercise, "sets">>(
    headers.map((workout) => workout.id),
    (ids) => readAllPages(async ({ from, to, count }) => {
      const result = await supabase.from("workout_exercises")
        .select("id,workout_id,exercise_id,position,notes,load_mode,exercise:exercises(*)", { count })
        .in("workout_id", ids).order("id").range(from, to).abortSignal(signal);
      return { ...result, data: result.data as unknown as Omit<WorkoutExercise, "sets">[] | null };
    }, signal),
  );
  const sets = await readIdBatches<WorkoutSet>(
    occurrences.map((occurrence) => occurrence.id),
    (ids) => readAllPages(async ({ from, to, count }) => {
      const result = await supabase.from("sets")
        .select("id,workout_exercise_id,position,weight_kg,reps,to_failure,set_type", { count })
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
