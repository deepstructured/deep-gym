"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import type { Profile } from "../model/types";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<Profile, "id" | "created_at">>) => {
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: (_data, patch) => {
      // Update synchronously before refetching so version-gated UI does not
      // reopen between a successful write and the fresh profile response.
      queryClient.setQueryData<Profile | null>(["profile"], (profile) =>
        profile ? { ...profile, ...patch } : profile,
      );
      return queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
