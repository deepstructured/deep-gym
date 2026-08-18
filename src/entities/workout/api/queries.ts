"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  equipmentLoadMode,
  type Equipment,
  type ExerciseLoadMode,
} from "@/shared/config/workout";
import { fromISODate } from "@/shared/lib/dates";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import type { Workout, WorkoutInput } from "../model/types";

const WORKOUT_SELECT = `
  *,
  workout_exercises (
    *,
    exercise:exercises (*),
    sets (*)
  )
`;

const WORKOUT_LOAD_MODE_MISMATCH = "WORKOUT_LOAD_MODE_MISMATCH";

/** Recognize both the local preflight error and the authoritative database
 * trigger error so views can show one localized recovery message. */
export function isWorkoutLoadModeMismatchError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("message" in error)) return false;
  return String(error.message).includes(WORKOUT_LOAD_MODE_MISMATCH);
}

function loadModeMismatchError(): Error {
  return new Error(WORKOUT_LOAD_MODE_MISMATCH);
}

/** Fail before mutating a workout when a persisted draft was prepared under a
 * different bodyweight/external mode. The insert trigger repeats this check
 * under a row lock to close the race after this preflight. */
async function assertCurrentExerciseLoadModes(
  exercises: WorkoutInput["exercises"],
) {
  const expectedById = new Map<string, ExerciseLoadMode>();
  for (const exercise of exercises) {
    const previous = expectedById.get(exercise.exercise_id);
    if (previous && previous !== exercise.load_mode) {
      throw loadModeMismatchError();
    }
    expectedById.set(exercise.exercise_id, exercise.load_mode);
  }
  if (expectedById.size === 0) return;

  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, equipment")
    .in("id", [...expectedById.keys()]);
  if (error) throw error;

  const rows = data as { id: string; equipment: Equipment }[];
  if (rows.length !== expectedById.size) throw loadModeMismatchError();
  for (const row of rows) {
    if (expectedById.get(row.id) !== equipmentLoadMode(row.equipment)) {
      throw loadModeMismatchError();
    }
  }
}

function sortNested(workout: Workout): Workout {
  workout.workout_exercises.sort((a, b) => a.position - b.position);
  workout.workout_exercises.forEach((we) =>
    we.sets.sort((a, b) => a.position - b.position),
  );
  return workout;
}

/** Exact number of workouts visible to the signed-in user through RLS. */
export function useWorkoutCount(enabled = true) {
  return useQuery({
    queryKey: ["workouts", "count"],
    queryFn: async (): Promise<number> => {
      const supabase = getSupabaseBrowser();
      const { count, error } = await supabase
        .from("workouts")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    enabled,
  });
}

/** Workouts within [from, to] (ISO dates, inclusive), newest first. */
export function useWorkouts(from: string, to: string) {
  return useQuery({
    queryKey: ["workouts", from, to],
    queryFn: async (): Promise<Workout[]> => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("workouts")
        .select(WORKOUT_SELECT)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Workout[]).map(sortNested);
    },
  });
}

/** The user's most recent workout of a given type before `beforeDate` (for
 *  "copy last workout").
 *
 *  With `preferWeekdayOf` (an ISO date), a workout of that type on the same
 *  weekday beats a merely newer one: someone running Full Body on Wed/Fri/Sun
 *  gets last Sunday's session offered on a Sunday, not Friday's. Falls back
 *  to the newest of the type when that weekday has no history. */
export function useLastWorkoutOfType(
  type: string,
  beforeDate: string,
  preferWeekdayOf?: string | null,
) {
  return useQuery({
    queryKey: [
      "workouts",
      "last-of-type",
      type,
      beforeDate,
      preferWeekdayOf ?? null,
    ],
    queryFn: async (): Promise<Workout | null> => {
      const supabase = getSupabaseBrowser();

      let query = supabase
        .from("workouts")
        .select(WORKOUT_SELECT)
        .eq("type", type)
        .lt("date", beforeDate)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (preferWeekdayOf) {
        // Dates first (cheap), then one full fetch of the chosen workout.
        const { data: recent, error: datesError } = await supabase
          .from("workouts")
          .select("id, date")
          .eq("type", type)
          .lt("date", beforeDate)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(60);
        if (datesError) throw datesError;
        const rows = recent as { id: string; date: string }[];
        const weekday = fromISODate(preferWeekdayOf).getDay();
        const match = rows.find(
          (row) => fromISODate(row.date).getDay() === weekday,
        );
        const targetId = (match ?? rows[0])?.id;
        if (!targetId) return null;
        query = query.eq("id", targetId);
      }

      const { data, error } = await query.limit(1);
      if (error) throw error;
      const workout = (data as Workout[])[0];
      return workout ? sortNested(workout) : null;
    },
    enabled: Boolean(type && beforeDate),
  });
}

/** Lightweight summary of every logged workout, newest first — enough to
 *  mark calendar days and label a picked session without nested rows. */
export interface WorkoutSummary {
  id: string;
  date: string;
  type: string;
  exerciseCount: number;
}

export function useWorkoutSummaries() {
  return useQuery({
    queryKey: ["workouts", "summaries"],
    queryFn: async (): Promise<WorkoutSummary[]> => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("workouts")
        .select("id, date, type, workout_exercises(count)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Row = {
        id: string;
        date: string;
        type: string;
        workout_exercises: { count: number }[];
      };
      return (data as Row[]).map((row) => ({
        id: row.id,
        date: row.date,
        type: row.type,
        exerciseCount: row.workout_exercises[0]?.count ?? 0,
      }));
    },
  });
}

/** One full workout fetched imperatively (e.g. after a calendar pick). */
export async function getWorkout(id: string): Promise<Workout> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("workouts")
    .select(WORKOUT_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return sortNested(data as Workout);
}

export function useWorkout(id: string) {
  return useQuery({
    queryKey: ["workout", id],
    queryFn: async (): Promise<Workout> => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("workouts")
        .select(WORKOUT_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return sortNested(data as Workout);
    },
    enabled: Boolean(id),
  });
}

async function insertExercisesWithSets(
  workoutId: string,
  exercises: WorkoutInput["exercises"],
) {
  const supabase = getSupabaseBrowser();

  for (let i = 0; i < exercises.length; i++) {
    const draft = exercises[i];
    const { data: we, error: weError } = await supabase
      .from("workout_exercises")
      .insert({
        workout_id: workoutId,
        exercise_id: draft.exercise_id,
        load_mode: draft.load_mode,
        position: i,
        notes: draft.notes,
      })
      .select("id")
      .single();
    if (weError) throw weError;

    if (draft.sets.length > 0) {
      const { error: setsError } = await supabase.from("sets").insert(
        draft.sets.map((set, position) => ({
          workout_exercise_id: we.id,
          position,
          weight_kg: set.weight_kg,
          reps: set.reps,
          to_failure: set.to_failure,
        })),
      );
      if (setsError) throw setsError;
    }
  }
}

export function useCreateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkoutInput): Promise<string> => {
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      await assertCurrentExerciseLoadModes(input.exercises);

      const { data: workout, error } = await supabase
        .from("workouts")
        .insert({
          user_id: user.id,
          type: input.type,
          date: input.date,
          notes: input.notes,
          body_weight_kg: input.body_weight_kg ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      try {
        await insertExercisesWithSets(workout.id, input.exercises);
      } catch (insertError) {
        // Creation is still a small client-side sequence. Remove the header so
        // a rejected stale draft does not leave an empty/partial workout.
        await supabase.from("workouts").delete().eq("id", workout.id);
        throw insertError;
      }
      return workout.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-history"] });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["exercise-usage"] }),
  });
}

export function useUpdateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: WorkoutInput;
    }) => {
      const supabase = getSupabaseBrowser();

      await assertCurrentExerciseLoadModes(input.exercises);

      const workoutPatch: {
        type: string;
        date: string;
        notes: string | null;
        body_weight_kg?: number | null;
      } = { type: input.type, date: input.date, notes: input.notes };
      // Editing a legacy draft must not erase a snapshot that the draft shape
      // did not know about. Once the form integrates the field it can pass null
      // explicitly to clear it.
      if ("body_weight_kg" in input) {
        workoutPatch.body_weight_kg = input.body_weight_kg ?? null;
      }

      const { error } = await supabase
        .from("workouts")
        .update(workoutPatch)
        .eq("id", id);
      if (error) throw error;

      // Simplest reliable sync: replace nested rows (cascade deletes sets).
      const { error: delError } = await supabase
        .from("workout_exercises")
        .delete()
        .eq("workout_id", id);
      if (delError) throw delError;

      await insertExercisesWithSets(id, input.exercises);
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workout", id] });
      queryClient.invalidateQueries({ queryKey: ["exercise-history"] });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["exercise-usage"] }),
  });
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.from("workouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-history"] });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["exercise-usage"] }),
  });
}
