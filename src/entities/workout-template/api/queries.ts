"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { requireAuthUserId, useAuthSession } from "@/shared/lib/auth-session";
import { readAllPages } from "@/shared/lib/supabase/pagination";
import type {
  WorkoutTemplate,
  WorkoutTemplateInput,
  WorkoutTemplateSummary,
} from "../model/types";

function sortNested(template: WorkoutTemplate): WorkoutTemplate {
  template.workout_template_exercises.sort(
    (a, b) => a.position - b.position,
  );
  return template;
}

function normalizeInput(input: WorkoutTemplateInput): WorkoutTemplateInput {
  const name = input.name.trim();
  const type = input.type.trim();
  const exerciseIds = Array.from(new Set(input.exerciseIds.filter(Boolean)));
  if (!name) throw new Error("Template name is required");
  if (!type) throw new Error("Workout type is required");
  if (exerciseIds.length === 0) {
    throw new Error("At least one exercise is required");
  }
  return { name, type, exerciseIds };
}

export function useWorkoutTemplates() {
  const { userId } = useAuthSession();
  return useQuery({
    queryKey: ["workout-templates", userId],
    enabled: Boolean(userId),
    queryFn: async ({ signal }): Promise<WorkoutTemplateSummary[]> => {
      const supabase = getSupabaseBrowser();
      type Row = Omit<WorkoutTemplateSummary, "exerciseCount"> & {
        workout_template_exercises: { count: number }[];
      };
      const rows = await readAllPages<Row>(({ from, to, count }) => supabase
        .from("workout_templates")
        .select("*, workout_template_exercises(count)", { count }).eq("user_id", userId!)
        .order("updated_at", { ascending: false }).order("name").order("id")
        .range(from, to).abortSignal(signal), signal);
      return rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        type: row.type,
        created_at: row.created_at,
        updated_at: row.updated_at,
        exerciseCount: row.workout_template_exercises[0]?.count ?? 0,
      }));
    },
  });
}

export function useWorkoutTemplate(id: string) {
  const { userId } = useAuthSession();
  return useQuery({
    queryKey: ["workout-template", id, userId],
    queryFn: ({ signal }) => getWorkoutTemplate(id, signal),
    enabled: Boolean(id && userId),
  });
}

export async function getWorkoutTemplate(id: string, signal?: AbortSignal): Promise<WorkoutTemplate> {
  const userId = requireAuthUserId();
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("workout_templates")
    .select("*")
    .eq("id", id).eq("user_id", userId)
    .abortSignal(signal ?? new AbortController().signal)
    .single();
  if (error) throw error;
  if (process.env.NEXT_PUBLIC_BACKEND === "postgres") {
    if (requireAuthUserId() !== userId) throw new Error("Session changed");
    return sortNested(data as WorkoutTemplate);
  }
  const exercises = await readAllPages<WorkoutTemplate["workout_template_exercises"][number]>(async ({ from, to, count }) => {
    const result = await supabase.from("workout_template_exercises")
      .select("*, exercise:exercises(*)", { count }).eq("template_id", id)
      .order("position").order("id").range(from, to)
      .abortSignal(signal ?? new AbortController().signal);
    return { ...result, data: result.data as unknown as WorkoutTemplate["workout_template_exercises"] | null };
  }, signal);
  if (requireAuthUserId() !== userId) throw new Error("Session changed");
  return sortNested({ ...data, workout_template_exercises: exercises } as WorkoutTemplate);
}

export function useCreateWorkoutTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkoutTemplateInput): Promise<string> => {
      requireAuthUserId();
      const supabase = getSupabaseBrowser();
      const normalized = normalizeInput(input);
      const { data, error } = await supabase.rpc("create_workout_template", {
        p_name: normalized.name,
        p_type: normalized.type,
        p_exercise_ids: normalized.exerciseIds,
      });
      if (error) throw error;
      if (typeof data !== "string") {
        throw new Error("Template was not created");
      }
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] }),
  });
}

export function useUpdateWorkoutTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: WorkoutTemplateInput;
    }) => {
      requireAuthUserId();
      const supabase = getSupabaseBrowser();
      const normalized = normalizeInput(input);
      const { error } = await supabase.rpc("update_workout_template", {
        p_template_id: id,
        p_name: normalized.name,
        p_type: normalized.type,
        p_exercise_ids: normalized.exerciseIds,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] });
      queryClient.invalidateQueries({ queryKey: ["workout-template", id] });
    },
  });
}

export function useDeleteWorkoutTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase
        .from("workout_templates")
        .delete()
        .eq("id", id).eq("user_id", requireAuthUserId());
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["workout-template", id] });
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] });
    },
  });
}
