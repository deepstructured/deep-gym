"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { requireAuthUserId, useAuthSession } from "@/shared/lib/auth-session";
import { readAllPages } from "@/shared/lib/supabase/pagination";
import type { MuscleGroup } from "../model/types";

export function useMuscleGroups() {
  const { userId } = useAuthSession();
  return useQuery({
    queryKey: ["muscle-groups", userId],
    enabled: Boolean(userId),
    queryFn: async ({ signal }): Promise<MuscleGroup[]> => {
      const supabase = getSupabaseBrowser();
      return readAllPages<MuscleGroup>(({ from, to, count }) => supabase
        .from("muscle_groups")
        .select("*", { count })
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .order("sort_order")
        .order("name").order("id")
        .range(from, to).abortSignal(signal), signal);
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateMuscleGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const supabase = getSupabaseBrowser();
      const userId = requireAuthUserId();
      const { error } = await supabase
        .from("muscle_groups")
        .insert({ name: name.trim(), user_id: userId });
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["muscle-groups"] }),
  });
}

export function useDeleteMuscleGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase
        .from("muscle_groups")
        .delete()
        .eq("id", id).eq("user_id", requireAuthUserId());
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["muscle-groups"] }),
  });
}
