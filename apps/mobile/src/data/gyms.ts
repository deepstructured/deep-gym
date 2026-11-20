import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers/auth-provider";
import { supabase } from "../lib/supabase";
import { useProfile } from "./queries";
import { useGymPreferenceState } from "@deepgym/core/gym-preference";
import { deleteGym, fetchGyms, saveGym, type SaveGymInput } from "@deepgym/core/gym-data";

export function useGymPreference() {
  const { user } = useAuth();
  const { data: profile, isError } = useProfile();
  return useGymPreferenceState(supabase, user?.id, profile, isError);
}

export function useGyms(enabled = true) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ["gyms", userId],
    enabled: enabled && Boolean(userId),
    queryFn: ({ signal }) => fetchGyms(supabase, userId!, signal),
  });
}

export function useSaveGym() {
  const { user } = useAuth();
  const userId = user?.id;
  const client = useQueryClient();
  return useMutation({
    mutationFn: (value: SaveGymInput) => {
      if (!userId) throw new Error("Not signed in");
      return saveGym(supabase, value);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["gyms", userId] }),
  });
}

export function useDeleteGym() {
  const { user } = useAuth();
  const userId = user?.id;
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("Not signed in");
      await deleteGym(supabase, id, userId!);
    },
    onSuccess: () => Promise.all(["gyms", "workouts", "workout", "profile"].map(key =>
      client.invalidateQueries({ queryKey: [key] }))),
  });
}
