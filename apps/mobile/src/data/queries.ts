import { fetchExercises, fetchMuscleGroups } from "@deepgym/core/catalog-read";
import { fetchWorkout, fetchWorkouts } from "@deepgym/core/workout-read";
import { createCatalogExercise, writeWorkout } from "@deepgym/core/gym-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ExerciseInput,
  Profile,
  WorkoutInput,
  WorkoutTemplateSummary,
  WorkoutTemplate,
  WorkoutTemplateInput,
} from "@deepgym/core/types";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/auth-provider";

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    refetchOnWindowFocus: "always",
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] }),
  });
}

/** Every screen shares a single ordered history cache for this account. */
export function useWorkouts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workouts", user?.id],
    enabled: Boolean(user),
    queryFn: ({ signal }) => fetchWorkouts(supabase, user!.id, signal),
  });
}

export function useWorkout(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workout", user?.id, id],
    enabled: Boolean(user && id),
    queryFn: ({ signal }) => fetchWorkout(supabase, user!.id, id, signal),
  });
}

export function useDeleteWorkout() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("workouts")
        .delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["workout", user?.id, id] });
      queryClient.invalidateQueries({ queryKey: ["workouts", user?.id] });
    },
  });
}

export function useExercises() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["exercises", user?.id],
    enabled: Boolean(user),
    queryFn: ({ signal }) => fetchExercises(supabase, user!.id, signal),
  });
}

export function useMuscleGroups() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["muscle-groups", user?.id],
    enabled: Boolean(user),
    queryFn: ({ signal }) => fetchMuscleGroups(supabase, user!.id, signal),
  });
}

export function useTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["templates", user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<WorkoutTemplateSummary[]> => {
      const { data, error } = await supabase
        .from("workout_templates")
        .select("*, workout_template_exercises(count)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as Array<Omit<WorkoutTemplateSummary, "exerciseCount"> & {
        workout_template_exercises: Array<{ count: number }>;
      }>).map((row) => ({
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

export function useTemplate(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["template", user?.id, id],
    enabled: Boolean(user && id),
    queryFn: async (): Promise<WorkoutTemplate> => {
      const { data, error } = await supabase
        .from("workout_templates")
        .select("*, workout_template_exercises (*, exercise:exercises (*))")
        .eq("id", id)
        .single();
      if (error) throw error;
      const template = data as WorkoutTemplate;
      template.workout_template_exercises.sort((a, b) => a.position - b.position);
      return template;
    },
  });
}

export function useUpdateTemplate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: WorkoutTemplateInput }) => {
      if (!user) throw new Error("Not signed in");
      const name = input.name.trim();
      const type = input.type.trim();
      const exerciseIds = [...new Set(input.exerciseIds)];
      if (!name || !type || !exerciseIds.length) {
        throw new Error("Add a name, type and at least one exercise");
      }
      const { error } = await supabase.rpc("update_workout_template", {
        p_template_id: id,
        p_name: name,
        p_type: type,
        p_exercise_ids: exerciseIds,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["template", user?.id, id] });
      queryClient.invalidateQueries({ queryKey: ["templates", user?.id] });
    },
  });
}

export function useDeleteTemplate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("workout_templates")
        .delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["template", user?.id, id] });
      queryClient.invalidateQueries({ queryKey: ["templates", user?.id] });
    },
  });
}

export function useCreateExercise() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExerciseInput & { gym_id?: string | null }) => {
      if (!user) throw new Error("Not signed in");
      return createCatalogExercise(supabase, user.id, input);
    },
    onSuccess: (_exercise, input) => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["exercises", user?.id] }),
      ...(input.gym_ids?.length || input.gym_id ? [queryClient.invalidateQueries({ queryKey: ["gyms"] })] : []),
    ]),
  });
}

export function useCreateTemplate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkoutTemplateInput): Promise<string> => {
      const name = input.name.trim();
      const type = input.type.trim();
      const exerciseIds = [...new Set(input.exerciseIds)];
      if (!name || !type || exerciseIds.length === 0) {
        throw new Error("Add a name, type and at least one exercise");
      }
      const { data, error } = await supabase.rpc("create_workout_template", {
        p_name: name,
        p_type: type,
        p_exercise_ids: exerciseIds,
      });
      if (error) throw error;
      if (typeof data !== "string") throw new Error("Template was not created");
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["templates", user?.id] }),
  });
}

/** The database RPC saves the workout and every nested row in one transaction. */
export function useCreateWorkout() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, createKey }: { input: WorkoutInput; createKey: string }): Promise<string> => {
      if (!user) throw new Error("Not signed in");
      if (input.exercises.length === 0) throw new Error("Add an exercise first");
      const { data, error } = await writeWorkout(supabase, input, null, createKey);
      if (error) throw error;
      if (typeof data !== "string") throw new Error("Workout was not created");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["exercises", user?.id] });
    },
  });
}
