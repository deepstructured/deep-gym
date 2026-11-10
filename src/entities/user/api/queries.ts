"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import type { Profile } from "../model/types";
import { getAuthSessionSnapshot, requireAuthUserId, useAuthSession } from "@/shared/lib/auth-session";

export const profileQueryKey = (userId: string | null) => ["profile", userId] as const;

export function useProfile() {
  const session = useAuthSession();
  return useQuery({
    queryKey: profileQueryKey(session.userId),
    enabled: session.status === "authenticated",
    queryFn: async ({ signal }): Promise<Profile> => {
      const supabase = getSupabaseBrowser();
      if (!session.userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.userId)
        .abortSignal(signal)
        .single();
      if (error?.code === "PGRST116" && process.env.NEXT_PUBLIC_BACKEND !== "postgres") {
        // Repair only the authenticated account through a scoped RPC. The
        // function never overwrites existing settings or copies Telegram IDs
        // from editable metadata. All other read errors remain visible.
        const repaired = await supabase.rpc("ensure_current_profile").abortSignal(signal).single<Profile>();
        if (repaired.error) throw repaired.error;
        if (!repaired.data || repaired.data.id !== session.userId) throw new Error("Profile identity mismatch");
        return repaired.data as Profile;
      }
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
      const userId = requireAuthUserId();
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return { userId, profile: data as Profile };
    },
    onSuccess: ({ userId, profile }) => {
      if (getAuthSessionSnapshot().userId !== userId) return;
      // Use the returned row directly. A second request must not keep a
      // completed save pending or briefly reopen version-gated UI.
      queryClient.setQueryData<Profile>(profileQueryKey(userId), profile);
    },
  });
}
