"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import type { Exercise, ExerciseInput } from "../model/types";

export function useExercises() {
  return useQuery({
    queryKey: ["exercises"],
    queryFn: async (): Promise<Exercise[]> => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Exercise[];
    },
  });
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: ["exercise", id],
    queryFn: async (): Promise<Exercise> => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Exercise;
    },
    enabled: Boolean(id),
  });
}

/** Number of saved workout occurrences, including occurrences with no sets.
 * Once non-zero, crossing the external/bodyweight boundary is unsafe. */
export function useExerciseUsageCount(id: string) {
  return useQuery({
    queryKey: ["exercise-usage", id],
    queryFn: async (): Promise<number> => {
      const supabase = getSupabaseBrowser();
      const { count, error } = await supabase
        .from("workout_exercises")
        .select("id", { count: "exact", head: true })
        .eq("exercise_id", id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: Boolean(id),
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExerciseInput): Promise<Exercise> => {
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const normalizedInput =
        input.equipment === "bodyweight"
          ? { ...input, working_weight_kg: null }
          : input;
      const { data, error } = await supabase
        .from("exercises")
        .insert({ ...normalizedInput, user_id: user.id })
        .select("*")
        .single();
      if (error) throw error;
      return data as Exercise;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useUpdateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<ExerciseInput>;
    }) => {
      const supabase = getSupabaseBrowser();
      const normalizedPatch =
        patch.equipment === "bodyweight"
          ? { ...patch, working_weight_kg: null }
          : patch;
      const { error } = await supabase
        .from("exercises")
        .update(normalizedPatch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      queryClient.invalidateQueries({ queryKey: ["exercise", id] });
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] });
      queryClient.invalidateQueries({ queryKey: ["workout-template"] });
    },
  });
}

export function useDeleteExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.from("exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] });
      queryClient.invalidateQueries({ queryKey: ["workout-template"] });
    },
  });
}
