"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireAuthUserId, useAuthSession } from "@/shared/lib/auth-session";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { useProfile } from "@/entities/user";
import { useGymPreferenceState } from "@deepgym/core/gym-preference";
import { deleteGym, fetchGyms, saveGym, type SaveGymInput } from "@deepgym/core/gym-data";

export function useGymPreference() {
  const { userId } = useAuthSession();
  const { data: profile, isError } = useProfile();
  return useGymPreferenceState(getSupabaseBrowser(), userId, profile, isError);
}

export function useGyms(enabled = true) {
  const { userId, status } = useAuthSession();
  return useQuery({
    queryKey: ["gyms", userId],
    enabled: enabled && status === "authenticated",
    queryFn: ({ signal }) => fetchGyms(getSupabaseBrowser(), userId!, signal),
  });
}

export function useSaveGym() {
  const { userId } = useAuthSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (value: SaveGymInput) => {
      if (requireAuthUserId() !== userId) throw new Error("Session changed");
      return saveGym(getSupabaseBrowser(), value);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["gyms", userId] }),
  });
}

export function useDeleteGym() {
  const { userId } = useAuthSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (requireAuthUserId() !== userId) throw new Error("Session changed");
      await deleteGym(getSupabaseBrowser(), id, userId!);
    },
    onSuccess: () => Promise.all(["gyms", "workouts", "workout", "profile"].map(key =>
      client.invalidateQueries({ queryKey: [key] }))),
  });
}
