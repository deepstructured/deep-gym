import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Exercise } from "@/entities/exercise";
import type { Workout, WorkoutInput } from "@/entities/workout";
import type { Equipment } from "@/shared/config/workout";
import { todayISO } from "@/shared/lib/dates";
import {
  kgToUnit,
  parseWeight,
  roundWeight,
  unitToKg,
  type Unit,
} from "@/shared/lib/weight";

export { parseWeight };

export interface DraftSet {
  key: string;
  weight: string; // in the user's display unit
  reps: string;
  toFailure: boolean;
}

export interface DraftExercise {
  key: string;
  exerciseId: string;
  name: string;
  muscleGroupName: string;
  equipment: Equipment;
  machineSettings: string | null;
  /** Effective display unit for this exercise (override or profile default). */
  unit: Unit;
  notes: string;
  showNotes: boolean;
  sets: DraftSet[];
}

export interface WorkoutDraft {
  type: string;
  date: string;
  notes: string;
  showNotes: boolean;
  exercises: DraftExercise[];
}

/** Local list key. crypto.randomUUID needs a secure context (HTTPS or
 *  localhost) — opening the dev server over LAN http:// on a phone doesn't
 *  have it, so fall back to getRandomValues, which works everywhere. */
function key(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function newSet(prev?: DraftSet): DraftSet {
  return {
    key: key(),
    weight: prev?.weight ?? "",
    reps: prev?.reps ?? "",
    toFailure: false,
  };
}

export function emptyDraft(): WorkoutDraft {
  return {
    type: "Full Body",
    date: todayISO(),
    notes: "",
    showNotes: false,
    exercises: [],
  };
}

/** Add a picked exercise: first set is created automatically, weight
 *  prefilled from the exercise's current working weight. */
export function exerciseToDraft(
  exercise: Exercise,
  muscleGroupName: string,
  defaultUnit: Unit,
): DraftExercise {
  const unit = exercise.unit ?? defaultUnit;
  const prefill =
    exercise.working_weight_kg != null
      ? String(roundWeight(kgToUnit(exercise.working_weight_kg, unit)))
      : "";
  return {
    key: key(),
    exerciseId: exercise.id,
    name: exercise.name,
    muscleGroupName,
    equipment: exercise.equipment,
    machineSettings: exercise.machine_settings,
    unit,
    notes: "",
    showNotes: false,
    sets: [{ key: key(), weight: prefill, reps: "", toFailure: false }],
  };
}

export function workoutToDraft(
  workout: Workout,
  groupNames: Map<string, string>,
  defaultUnit: Unit,
): WorkoutDraft {
  return {
    type: workout.type,
    date: workout.date,
    notes: workout.notes ?? "",
    showNotes: Boolean(workout.notes),
    exercises: workout.workout_exercises.map((we) => {
      const unit = we.exercise?.unit ?? defaultUnit;
      return {
        key: key(),
        exerciseId: we.exercise_id,
        name: we.exercise?.name ?? "Exercise",
        muscleGroupName:
          groupNames.get(we.exercise?.muscle_group_id ?? "") ?? "",
        equipment: we.exercise?.equipment ?? "free_weight",
        machineSettings: we.exercise?.machine_settings ?? null,
        unit,
        notes: we.notes ?? "",
        showNotes: Boolean(we.notes),
        sets: we.sets.map((set) => ({
          key: key(),
          weight:
            set.weight_kg != null
              ? String(roundWeight(kgToUnit(set.weight_kg, unit)))
              : "",
          reps: set.reps != null ? String(set.reps) : "",
          toFailure: set.to_failure,
        })),
      };
    }),
  };
}

export function draftToInput(
  draft: WorkoutDraft,
  defaultUnit: Unit,
): WorkoutInput {
  return {
    type: draft.type.trim() || "Workout",
    date: draft.date,
    notes: draft.notes.trim() || null,
    exercises: draft.exercises.map((exercise) => {
      // fall back for drafts persisted before per-exercise units existed
      const unit = exercise.unit ?? defaultUnit;
      return {
        exercise_id: exercise.exerciseId,
        notes: exercise.notes.trim() || null,
        sets: exercise.sets.map((set) => {
          const weight = parseWeight(set.weight);
          const reps = parseInt(set.reps, 10);
          return {
            weight_kg:
              weight != null
                ? Math.round(unitToKg(weight, unit) * 100) / 100
                : null,
            reps: Number.isFinite(reps) && reps > 0 ? reps : null,
            to_failure: set.toFailure,
          };
        }),
      };
    }),
  };
}

interface NewWorkoutDraftStore {
  draft: WorkoutDraft;
  setDraft: (draft: WorkoutDraft) => void;
  reset: () => void;
}

/** Persisted draft for the "new workout" flow — survives navigation
 *  and app restarts mid-session at the gym. */
export const useNewWorkoutDraft = create<NewWorkoutDraftStore>()(
  persist(
    (set) => ({
      draft: emptyDraft(),
      setDraft: (draft) => set({ draft }),
      reset: () => set({ draft: emptyDraft() }),
    }),
    { name: "deepgym-workout-draft" },
  ),
);
