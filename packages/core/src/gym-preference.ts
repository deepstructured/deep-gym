import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "./types";

type PreferencePatch = { gym_filter_all: boolean; last_gym_id?: string | null };

/** Pending choices are shared by every selector and flushed in click order,
 * including when the screen that initiated a write has already unmounted. */
export function useGymPreferenceState(client: SupabaseClient, owner: string | null | undefined, profile: Profile | undefined, profileError: boolean) {
  const queries = useQueryClient();
  const profileKey = ["profile", owner];
  const mutationKey = ["gym-preference", owner];
  const writes = useMutationState({
    filters: { mutationKey, exact: true },
    select: mutation => ({ status: mutation.state.status, patch: mutation.state.variables as PreferencePatch }),
  });
  const write = useMutation({
    mutationKey,
    scope: { id: `gym-preference:${owner}` },
    mutationFn: async (patch: PreferencePatch) => {
      if (!owner) throw new Error("Not signed in");
      const { data, error } = await client.from("profiles").update(patch).eq("id", owner).select("*").single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: async (saved) => {
      await queries.cancelQueries({ queryKey: profileKey, exact: true });
      queries.setQueryData<Profile>(profileKey, current => current
        ? { ...current, last_gym_id: saved.last_gym_id, gym_filter_all: saved.gym_filter_all }
        : saved);
    },
    onError: () => queries.invalidateQueries({ queryKey: profileKey, exact: true }),
  });
  let gymId = profile?.last_gym_id ?? null;
  let showAll = profile?.gym_filter_all ?? true;
  for (const { status, patch } of writes) {
    if (status !== "pending") continue;
    if (patch.last_gym_id !== undefined) gymId = patch.last_gym_id;
    showAll = patch.gym_filter_all;
  }
  const rememberGym = (id: string | null) => write.mutate({ last_gym_id: id, gym_filter_all: false });
  return {
    gymId,
    ready: Boolean(profile) || profileError,
    isError: writes[writes.length - 1]?.status === "error",
    filter: showAll ? "" : gymId ?? "none",
    rememberGym,
    rememberFilter: (filter: string) => filter
      ? rememberGym(filter === "none" ? null : filter)
      : write.mutate({ gym_filter_all: true }),
  };
}
