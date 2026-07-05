"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

function sortNested(workout: Workout): Workout {
  workout.workout_exercises.sort((a, b) => a.position - b.position);
  workout.workout_exercises.forEach((we) =>
    we.sets.sort((a, b) => a.position - b.position),
  );
  return workout;
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

      const { data: workout, error } = await supabase
        .from("workouts")
        .insert({
          user_id: user.id,
          type: input.type,
          date: input.date,
          notes: input.notes,
        })
        .select("id")
        .single();
      if (error) throw error;

      await insertExercisesWithSets(workout.id, input.exercises);
      return workout.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-history"] });
    },
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

      const { error } = await supabase
        .from("workouts")
        .update({ type: input.type, date: input.date, notes: input.notes })
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
  });
}
