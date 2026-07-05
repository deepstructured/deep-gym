"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import type { MuscleGroup } from "../model/types";

export function useMuscleGroups() {
  return useQuery({
    queryKey: ["muscle-groups"],
    queryFn: async (): Promise<MuscleGroup[]> => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("muscle_groups")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data as MuscleGroup[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateMuscleGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("muscle_groups")
        .insert({ name: name.trim(), user_id: user.id });
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
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["muscle-groups"] }),
  });
}
