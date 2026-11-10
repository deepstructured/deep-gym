"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireAuthUserId, useAuthSession } from "@/shared/lib/auth-session";
import { fromISODate, toISODate } from "@/shared/lib/dates";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { readAllPages } from "@/shared/lib/supabase/pagination";
import type { Workout, WorkoutInput } from "../model/types";
import { hydrateWorkouts, WORKOUT_FIELDS, type WorkoutHeader } from "./read-workouts";
import { workoutRpcInput } from "./workout-input";

export function isWorkoutLoadModeMismatchError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "message" in error &&
    String(error.message).includes("WORKOUT_LOAD_MODE_MISMATCH"));
}

/** Compatibility for existing form errors. Writes now require migration 0009;
 * there is deliberately no destructive multi-request fallback. */
export function isWarmupsUnsupportedError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "message" in error &&
    String(error.message).includes("WARMUPS_UNSUPPORTED"));
}

export function isAtomicWorkoutUnsupportedError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error &&
    (error.code === "PGRST202" || error.code === "42883"));
}

export function isWorkoutCreateConflictError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "message" in error &&
    String(error.message).includes("WORKOUT_CREATE_KEY_CONFLICT"));
}

export function useWorkoutCount(enabled = true) {
  const { userId, status } = useAuthSession();
  return useQuery({
    queryKey: ["workouts", "count", userId],
    queryFn: async ({ signal }): Promise<number> => {
      const { count, error } = await getSupabaseBrowser().from("workouts")
        .select("id", { count: "exact", head: true }).eq("user_id", userId!)
        .abortSignal(signal);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: enabled && status === "authenticated",
  });
}

/** Complete history for detailed analytics. Home uses compact aggregates. */
export function useAllWorkouts() {
  return useWorkouts("2000-01-01", toISODate(new Date()));
}

export function useWorkouts(from: string, to: string) {
  const { userId, status } = useAuthSession();
  return useQuery({
    queryKey: ["workouts", userId, from, to],
    queryFn: async ({ signal }): Promise<Workout[]> => {
      const supabase = getSupabaseBrowser();
      const headers = await readAllPages<WorkoutHeader>(async (page) => {
        const result = await supabase.from("workouts")
          .select(WORKOUT_FIELDS, { count: page.count }).eq("user_id", userId!)
          .gte("date", from).lte("date", to)
          .order("date", { ascending: false }).order("created_at", { ascending: false })
          .order("id", { ascending: false }).range(page.from, page.to).abortSignal(signal);
        return { ...result, data: result.data as WorkoutHeader[] | null };
      }, signal);
      return hydrateWorkouts(headers, signal);
    },
    enabled: status === "authenticated",
  });
}

export function useRecentWorkouts(limit = 3) {
  const { userId, status } = useAuthSession();
  return useQuery({
    queryKey: ["workouts", "recent", userId, limit],
    queryFn: async ({ signal }) => {
      const { data, error } = await getSupabaseBrowser().from("workouts")
        .select(WORKOUT_FIELDS).eq("user_id", userId!).lte("date", toISODate(new Date()))
        .order("date", { ascending: false }).order("created_at", { ascending: false })
        .order("id", { ascending: false }).limit(limit).abortSignal(signal);
      if (error) throw error;
      return hydrateWorkouts(data as WorkoutHeader[], signal);
    },
    enabled: status === "authenticated",
  });
}

/** Prefer the newest matching weekday among the last 60 sessions. */
export function useLastWorkoutOfType(type: string, beforeDate: string, preferWeekdayOf?: string | null) {
  const { userId, status } = useAuthSession();
  return useQuery({
    queryKey: ["workouts", "last-of-type", userId, type, beforeDate, preferWeekdayOf ?? null],
    queryFn: async ({ signal }): Promise<Workout | null> => {
      const { data, error } = await getSupabaseBrowser().from("workouts")
        .select(WORKOUT_FIELDS).eq("user_id", userId!).eq("type", type).lt("date", beforeDate)
        .order("date", { ascending: false }).order("created_at", { ascending: false })
        .order("id", { ascending: false }).limit(preferWeekdayOf ? 60 : 1).abortSignal(signal);
      if (error) throw error;
      const rows = data as WorkoutHeader[];
      const weekday = preferWeekdayOf ? fromISODate(preferWeekdayOf).getDay() : null;
      const header = rows.find((row) => weekday != null && fromISODate(row.date).getDay() === weekday) ?? rows[0];
      return header ? (await hydrateWorkouts([header], signal))[0] : null;
    },
    enabled: status === "authenticated" && Boolean(type && beforeDate),
  });
}

export interface WorkoutSummary { id: string; date: string; type: string; exerciseCount: number }

export function useWorkoutSummaries() {
  const { userId, status } = useAuthSession();
  return useQuery({
    queryKey: ["workouts", "summaries", userId],
    queryFn: async ({ signal }): Promise<WorkoutSummary[]> => {
      type Row = { id: string; date: string; type: string; workout_exercises: { count: number }[] };
      const rows = await readAllPages<Row>(async (page) => {
        const result = await getSupabaseBrowser().from("workouts")
          .select("id,date,type,workout_exercises(count)", { count: page.count }).eq("user_id", userId!)
          .order("date", { ascending: false }).order("created_at", { ascending: false })
          .order("id", { ascending: false }).range(page.from, page.to).abortSignal(signal);
        return { ...result, data: result.data as Row[] | null };
      }, signal);
      return rows.map((row) => ({ id: row.id, date: row.date, type: row.type, exerciseCount: row.workout_exercises[0]?.count ?? 0 }));
    },
    enabled: status === "authenticated",
  });
}

export async function getWorkout(id: string, signal = new AbortController().signal): Promise<Workout> {
  const userId = requireAuthUserId();
  const { data, error } = await getSupabaseBrowser().from("workouts")
    .select(WORKOUT_FIELDS).eq("id", id).eq("user_id", userId).abortSignal(signal).single();
  if (error) throw error;
  // The own API returns the complete aggregate in one transaction.
  if (process.env.NEXT_PUBLIC_BACKEND === "postgres") return data as Workout;
  return (await hydrateWorkouts([data as WorkoutHeader], signal))[0];
}

export function useWorkout(id: string) {
  const { userId, status } = useAuthSession();
  return useQuery({
    queryKey: ["workout", id, userId],
    queryFn: ({ signal }) => getWorkout(id, signal),
    enabled: status === "authenticated" && Boolean(id),
  });
}

function assertSessionOwner(userId: string | null) {
  if (!userId || requireAuthUserId() !== userId) throw new Error("Not signed in");
}

export function useCreateWorkout() {
  const { userId } = useAuthSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, createKey }: { input: WorkoutInput; createKey: string }): Promise<string> => {
      assertSessionOwner(userId);
      const { data, error } = await getSupabaseBrowser().rpc("save_workout_atomic", {
        p_input: workoutRpcInput(input), p_workout_id: null, p_create_key: createKey,
      });
      if (error) throw error;
      if (typeof data !== "string") throw new Error("Workout was not created");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-history"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-usage"] });
    },
  });
}

export function useUpdateWorkout() {
  const { userId } = useAuthSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: WorkoutInput }) => {
      assertSessionOwner(userId);
      const { error } = await getSupabaseBrowser().rpc("save_workout_atomic", {
        p_input: workoutRpcInput(input), p_workout_id: id, p_create_key: null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workout", id] });
      queryClient.invalidateQueries({ queryKey: ["exercise-history"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-usage"] });
    },
  });
}

export function useDeleteWorkout() {
  const { userId } = useAuthSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertSessionOwner(userId);
      const { error } = await getSupabaseBrowser().from("workouts").delete().eq("id", id).eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["workout", id] });
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-history"] });
      queryClient.invalidateQueries({ queryKey: ["exercise-usage"] });
    },
  });
}
