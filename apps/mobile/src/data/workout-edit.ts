import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Workout, WorkoutInput } from "@deepgym/core/types";
import { kgToUnit, roundWeight, type Unit } from "@deepgym/core/weight";
import { createDraftSet, type WorkoutDraft } from "./draft";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/auth-provider";

function key(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Local edit state: it never reads or writes the persisted new-workout draft. */
export function workoutToEditDraft(
  workout: Workout,
  groupNames: Map<string, string>,
  defaultUnit: Unit,
): WorkoutDraft {
  return {
    type: workout.type,
    date: workout.date,
    bodyWeight: workout.body_weight_kg == null
      ? ""
      : String(roundWeight(kgToUnit(workout.body_weight_kg, defaultUnit))),
    bodyWeightUnit: defaultUnit,
    bodyWeightAuto: false,
    notes: workout.notes ?? "",
    showNotes: Boolean(workout.notes),
    exercises: workout.workout_exercises.map((occurrence) => {
      const unit = occurrence.exercise?.unit ?? defaultUnit;
      const bodyweight = occurrence.load_mode === "bodyweight";
      return {
        key: key(),
        exerciseId: occurrence.exercise_id,
        name: occurrence.exercise?.name ?? "Exercise",
        muscleGroupName: groupNames.get(occurrence.exercise?.muscle_group_id ?? "") ?? "",
        equipment: bodyweight
          ? "bodyweight" as const
          : occurrence.exercise?.equipment === "bodyweight"
            ? "free_weight" as const
            : occurrence.exercise?.equipment ?? "free_weight" as const,
        machineSettings: occurrence.exercise?.machine_settings ?? null,
        unit,
        notes: occurrence.notes ?? "",
        showNotes: Boolean(occurrence.notes),
        sets: occurrence.sets.map((set) => {
          const addedKg = bodyweight && workout.body_weight_kg != null && set.weight_kg != null
            ? set.weight_kg - workout.body_weight_kg
            : null;
          return {
            ...createDraftSet(),
            weight: set.weight_kg == null ? "" : String(roundWeight(kgToUnit(set.weight_kg, unit))),
            addedWeight: addedKg != null
              ? String(roundWeight(kgToUnit(addedKg, unit)))
              : bodyweight ? "" : undefined,
            reps: set.reps == null ? "" : String(set.reps),
            toFailure: set.to_failure,
            warmup: set.set_type === "warmup",
          };
        }),
      };
    }),
  };
}

/** The database RPC replaces the nested rows in one transaction. */
export function useUpdateWorkout() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: WorkoutInput }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.rpc("save_workout_atomic", {
        p_input: input,
        p_workout_id: id,
        p_create_key: null,
      });
      if (error) throw error;
    },
    onSettled: (_result, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["workout", user?.id, id] });
      queryClient.invalidateQueries({ queryKey: ["workouts", user?.id] });
    },
  });
}
