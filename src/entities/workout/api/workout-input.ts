import type { WorkoutInput } from "../model/types";

/** One stable, explicit RPC payload for create and edit. UI-only properties
 * never affect the database's idempotency hash. Omitted legacy snapshots stay
 * omitted so an edit cannot accidentally erase the stored body weight. */
export function workoutRpcInput(input: WorkoutInput): WorkoutInput {
  return {
    type: input.type.trim(),
    date: input.date,
    notes: input.notes,
    ...("body_weight_kg" in input ? { body_weight_kg: input.body_weight_kg ?? null } : {}),
    exercises: input.exercises.map((exercise) => ({
      exercise_id: exercise.exercise_id,
      load_mode: exercise.load_mode,
      notes: exercise.notes,
      sets: exercise.sets.map((set) => ({
        weight_kg: set.weight_kg,
        reps: set.reps,
        to_failure: set.set_type === "warmup" ? false : set.to_failure,
        set_type: set.set_type,
      })),
    })),
  };
}
