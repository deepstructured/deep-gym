import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/auth-provider";

export function useCreateMuscleGroup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not signed in");
      const normalized = name.trim();
      if (!normalized) throw new Error("Name is required");
      const { error } = await supabase.from("muscle_groups")
        .insert({ user_id: user.id, name: normalized });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["muscle-groups", user?.id] }),
  });
}

export function useDeleteMuscleGroup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("muscle_groups")
        .delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["muscle-groups", user?.id] }),
  });
}
