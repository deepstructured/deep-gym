"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import type {
  WorkoutTemplate,
  WorkoutTemplateInput,
  WorkoutTemplateSummary,
} from "../model/types";

const WORKOUT_TEMPLATE_SELECT = `
  *,
  workout_template_exercises (
    *,
    exercise:exercises (*)
  )
`;

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
  return useQuery({
    queryKey: ["workout-templates"],
    queryFn: async (): Promise<WorkoutTemplateSummary[]> => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("workout_templates")
        .select("*, workout_template_exercises(count)")
        .order("updated_at", { ascending: false })
        .order("name");
      if (error) throw error;

      type Row = Omit<WorkoutTemplateSummary, "exerciseCount"> & {
        workout_template_exercises: { count: number }[];
      };
      return (data as Row[]).map((row) => ({
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
  return useQuery({
    queryKey: ["workout-template", id],
    queryFn: async (): Promise<WorkoutTemplate> => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("workout_templates")
        .select(WORKOUT_TEMPLATE_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return sortNested(data as WorkoutTemplate);
    },
    enabled: Boolean(id),
  });
}

export async function getWorkoutTemplate(id: string): Promise<WorkoutTemplate> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("workout_templates")
    .select(WORKOUT_TEMPLATE_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return sortNested(data as WorkoutTemplate);
}

export function useCreateWorkoutTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkoutTemplateInput): Promise<string> => {
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
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["workout-template", id] });
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] });
    },
  });
}
