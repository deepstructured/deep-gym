"use client";

import { createCatalogExercise, updateCatalogExercise } from "@deepgym/core/gym-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireAuthUserId, useAuthSession } from "@/shared/lib/auth-session";
import { fetchExercises } from "@deepgym/core/catalog-read";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import type { Exercise, ExerciseInput } from "../model/types";

/** `enabled` lets a lazy consumer (the command palette) defer the fetch
 *  until it is actually opened. */
export function useExercises(enabled = true) {
  const { userId, status } = useAuthSession();
  return useQuery({
    enabled: enabled && status === "authenticated",
    queryKey: ["exercises", userId],
    queryFn: ({ signal }) => fetchExercises(getSupabaseBrowser(), userId!, signal),
  });
}

export function useExercise(id: string) {
  const { userId, status } = useAuthSession();
  return useQuery({
    queryKey: ["exercise", id, userId],
    queryFn: async ({ signal }): Promise<Exercise> => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("id", id).eq("user_id", userId!)
        .abortSignal(signal).single();
      if (error) throw error;
      return data as Exercise;
    },
    enabled: status === "authenticated" && Boolean(id),
  });
}

/** Number of saved workout occurrences, including occurrences with no sets.
 * Once non-zero, crossing the external/bodyweight boundary is unsafe. */
export function useExerciseUsageCount(id: string) {
  const { userId, status } = useAuthSession();
  return useQuery({
    queryKey: ["exercise-usage", id, userId],
    queryFn: async ({ signal }): Promise<number> => {
      const supabase = getSupabaseBrowser();
      const { count, error } = await supabase
        .from("workout_exercises")
        .select("id", { count: "exact", head: true })
        .eq("exercise_id", id).abortSignal(signal);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: status === "authenticated" && Boolean(id),
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExerciseInput & { gym_id?: string | null }) => {
      return createCatalogExercise(getSupabaseBrowser(), requireAuthUserId(), input);
    },
    onSuccess: (_exercise, input) => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["exercises"] }),
      ...(input.gym_ids?.length || input.gym_id ? [queryClient.invalidateQueries({ queryKey: ["gyms"] })] : []),
    ]),
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
      return updateCatalogExercise(getSupabaseBrowser(), requireAuthUserId(), id, patch);
    },
    onSuccess: (_data, { id, patch }) => {
      if (patch.gym_ids !== undefined) queryClient.invalidateQueries({ queryKey: ["gyms"] });
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      queryClient.invalidateQueries({ queryKey: ["exercise", id] });
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-history"] });
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
      const { error } = await supabase.from("exercises").delete().eq("id", id).eq("user_id", requireAuthUserId());
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gyms"] });
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-history"] });
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] });
      queryClient.invalidateQueries({ queryKey: ["workout-template"] });
    },
  });
}
