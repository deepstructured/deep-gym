import type { SupabaseClient } from "@supabase/supabase-js";
import { readAllPages } from "./pagination";
import type { Exercise, ExerciseInput, Gym, GymInput, WorkoutInput } from "./types";

export type SaveGymInput = { id?: string; input: GymInput };

/** Library filters. A workout without a selected gym can use the full catalog. */
export function filterExercisesByGym<T extends { id: string; is_universal?: boolean }>(exercises: T[], gyms: Gym[], filter: string): T[] {
  if (!filter) return exercises;
  const available = new Set(gyms.find(gym => gym.id === filter)?.exercise_ids);
  return exercises.filter(exercise => exercise.is_universal !== false || available.has(exercise.id));
}

export function fetchGyms(client: SupabaseClient, owner: string, signal: AbortSignal): Promise<Gym[]> {
  return readAllPages(async (page) => {
    const result = await client.from("scoped_gym_catalog").select("*", { count: page.count }).eq("user_id", owner)
      .order("name").order("id").range(page.from, page.to).abortSignal(signal);
    return { ...result, data: result.data as Gym[] | null };
  }, signal);
}

export async function saveGym(client: SupabaseClient, { id, input }: SaveGymInput): Promise<string> {
  const { data, error } = await client.rpc("save_gym", {
    p_id: id ?? null, p_name: input.name.trim(), p_bar_weight_kg: input.bar_weight_kg,
    p_plates_kg: input.plates_kg, p_plates_lb: input.plates_lb, p_exercise_ids: input.exercise_ids,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteGym(client: SupabaseClient, id: string, owner: string): Promise<void> {
  const { error } = await client.from("gyms").delete().eq("id", id).eq("user_id", owner);
  if (error) throw error;
}

export async function createCatalogExercise(client: SupabaseClient, owner: string,
  { gym_ids, gym_id, ...fields }: ExerciseInput & { gym_id?: string | null }): Promise<Exercise> {
  const input = fields.equipment === "bodyweight" ? { ...fields, working_weight_kg: null } : fields;
  const ids = gym_ids ?? (gym_id ? [gym_id] : []);
  // Direct creates retain the universal database default during rollout.
  const { data, error } = ids.length
    ? await client.rpc("save_catalog_exercise", { p_id: null, p_input: input, p_gym_ids: ids }).single()
    : await client.from("exercises").insert({ ...input, user_id: owner }).select("*").single();
  if (error) throw error;
  return data as Exercise;
}

export async function updateCatalogExercise(client: SupabaseClient, owner: string,
  id: string, { gym_ids, ...fields }: Partial<ExerciseInput>): Promise<Exercise> {
  const patch = fields.equipment === "bodyweight" ? { ...fields, working_weight_kg: null } : fields;
  const { data, error } = gym_ids !== undefined
    ? await client.rpc("save_catalog_exercise", { p_id: id, p_input: patch, p_gym_ids: gym_ids }).single()
    : await client.from("exercises").update(patch).eq("id", id).eq("user_id", owner).select("*").single();
  if (error) throw error;
  return data as Exercise;
}

export function writeWorkout(client: SupabaseClient, input: WorkoutInput, id: string | null, createKey: string | null) {
  // An unassigned create must have the same idempotency hash on both clients
  // and across the rollout. A null on edit explicitly clears the stored gym.
  const { gym_id, ...fields } = input;
  const writesGym = gym_id != null || (id != null && gym_id === null);
  return client.rpc(writesGym ? "save_workout_at_gym" : "save_workout_atomic", {
    p_input: writesGym ? input : fields, p_workout_id: id, p_create_key: createKey,
  });
}
