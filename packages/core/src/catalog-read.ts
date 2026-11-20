import type { SupabaseClient } from "@supabase/supabase-js";
import { readAllPages } from "./pagination";
import type { Exercise, MuscleGroup } from "./types";

export function fetchExercises(client: SupabaseClient, ownerId: string, signal: AbortSignal): Promise<Exercise[]> {
  return readAllPages(({ from, to, count }) => client.from("exercises")
    .select("*", { count }).eq("user_id", ownerId)
    .order("name").order("id").range(from, to).abortSignal(signal), signal);
}

export function fetchMuscleGroups(client: SupabaseClient, ownerId: string, signal: AbortSignal): Promise<MuscleGroup[]> {
  return readAllPages(({ from, to, count }) => client.from("muscle_groups")
    .select("*", { count }).or(`user_id.is.null,user_id.eq.${ownerId}`)
    .order("sort_order").order("name").order("id").range(from, to).abortSignal(signal), signal);
}
