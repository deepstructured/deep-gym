import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Exercise } from "@/entities/exercise";
import type { Workout, WorkoutInput } from "@/entities/workout";
import {
  equipmentLoadMode,
  type Equipment,
} from "@/shared/config/workout";
import { NEW_WORKOUT_DRAFT_STORAGE_KEY } from "@/shared/config/storage";
import { todayISO } from "@/shared/lib/dates";
import {
  kgToUnit,
  parseSignedWeight,
  parseWeight,
  roundWeight,
  unitToKg,
  type Unit,
} from "@/shared/lib/weight";

export { parseWeight };

export interface DraftSet {
  key: string;
  /** Total effective load in the exercise's display unit. */
  weight: string;
  /** Bodyweight exercises only: signed added load; negative = assistance. */
  addedWeight?: string;
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
  /** Athlete body-weight snapshot in the profile display unit. */
  bodyWeight: string;
  /** Unit used by the persisted bodyWeight string. This prevents an open
   * draft from being reinterpreted if the profile unit changes meanwhile. */
  bodyWeightUnit?: Unit;
  /** While true, changing the workout date may select the latest measurement
   * on or before that date. Logging/editing a value turns this off. */
  bodyWeightAuto?: boolean;
  notes: string;
  showNotes: boolean;
  exercises: DraftExercise[];
}

export type WorkoutCopyMode = "full" | "last-weight";

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
    addedWeight: prev?.addedWeight,
    reps: prev?.reps ?? "",
    toFailure: false,
  };
}

export function emptyDraft(): WorkoutDraft {
  return {
    type: "Full Body",
    date: todayISO(),
    bodyWeight: "",
    bodyWeightAuto: true,
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
  bodyWeightKg?: number | null,
): DraftExercise {
  const unit = exercise.unit ?? defaultUnit;
  const prefill =
    exercise.equipment === "bodyweight" && bodyWeightKg != null
      ? String(roundWeight(kgToUnit(bodyWeightKg, unit)))
      : exercise.working_weight_kg != null
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
    sets: [
      {
        key: key(),
        weight: prefill,
        addedWeight: exercise.equipment === "bodyweight" ? "0" : undefined,
        reps: "",
        toFailure: false,
      },
    ],
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
    bodyWeight:
      workout.body_weight_kg != null
        ? String(roundWeight(kgToUnit(workout.body_weight_kg, defaultUnit)))
        : "",
    bodyWeightUnit: defaultUnit,
    bodyWeightAuto: false,
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
        equipment:
          we.load_mode === "bodyweight"
            ? "bodyweight"
            : we.exercise?.equipment === "bodyweight"
              ? "free_weight"
              : we.exercise?.equipment ?? "free_weight",
        machineSettings: we.exercise?.machine_settings ?? null,
        unit,
        notes: we.notes ?? "",
        showNotes: Boolean(we.notes),
        sets: we.sets.map((set) => {
          const bodyweight = we.load_mode === "bodyweight";
          const addedWeightKg =
            bodyweight &&
            workout.body_weight_kg != null &&
            set.weight_kg != null
              ? set.weight_kg - workout.body_weight_kg
              : null;
          return {
            key: key(),
            weight:
              set.weight_kg != null
                ? String(roundWeight(kgToUnit(set.weight_kg, unit)))
                : "",
            addedWeight:
              addedWeightKg != null
                ? String(roundWeight(kgToUnit(addedWeightKg, unit)))
                : bodyweight
                  ? ""
                  : undefined,
            reps: set.reps != null ? String(set.reps) : "",
            toFailure: set.to_failure,
          };
        }),
      };
    }),
  };
}

/** Build exercises for starting a new workout from a logged session.
 *
 * Copying deliberately never carries workout/exercise notes into the new
 * session. `full` preserves every logged set, while `last-weight` creates one
 * blank set per exercise using the last non-empty weight in source order. */
export function workoutToCopiedExercises(
  workout: Workout,
  groupNames: Map<string, string>,
  defaultUnit: Unit,
  mode: WorkoutCopyMode,
): DraftExercise[] {
  return workoutToDraft(workout, groupNames, defaultUnit).exercises.map(
    (exercise) => {
      let sets = exercise.sets;

      if (mode === "last-weight") {
        const lastWeightedSet = [...sets]
          .reverse()
          .find((set) => set.weight.trim() !== "");
        sets = [
          {
            key: key(),
            weight: lastWeightedSet?.weight ?? "",
            addedWeight: lastWeightedSet?.addedWeight,
            reps: "",
            toFailure: false,
          },
        ];
      }

      return {
        ...exercise,
        notes: "",
        showNotes: false,
        sets,
      };
    },
  );
}

export function draftToInput(
  draft: WorkoutDraft,
  defaultUnit: Unit,
): WorkoutInput {
  const bodyWeightDisplay = parseWeight(draft.bodyWeight ?? "");
  const bodyWeightUnit = draft.bodyWeightUnit ?? defaultUnit;
  const bodyWeightKg =
    bodyWeightDisplay != null
      ? Math.round(unitToKg(bodyWeightDisplay, bodyWeightUnit) * 100) / 100
      : null;

  return {
    type: draft.type.trim() || "Workout",
    date: draft.date,
    notes: draft.notes.trim() || null,
    body_weight_kg: bodyWeightKg,
    exercises: draft.exercises.map((exercise) => {
      // fall back for drafts persisted before per-exercise units existed
      const unit = exercise.unit ?? defaultUnit;
      return {
        exercise_id: exercise.exerciseId,
        load_mode: equipmentLoadMode(exercise.equipment),
        notes: exercise.notes.trim() || null,
        sets: exercise.sets.map((set) => {
          const weight = parseWeight(set.weight);
          const addedWeight = parseSignedWeight(set.addedWeight ?? "") ?? 0;
          const reps = parseInt(set.reps, 10);
          const totalBodyweightKg =
            exercise.equipment === "bodyweight" && bodyWeightKg != null
              ? bodyWeightKg + unitToKg(addedWeight, unit)
              : null;
          return {
            weight_kg:
              totalBodyweightKg != null && totalBodyweightKg > 0
                ? Math.round(totalBodyweightKg * 100) / 100
                : weight != null
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

/** Body-weight value from a draft in canonical kg. */
export function draftBodyWeightKg(
  draft: Pick<WorkoutDraft, "bodyWeight" | "bodyWeightUnit">,
  defaultUnit: Unit,
): number | null {
  const value = parseWeight(draft.bodyWeight ?? "");
  return value != null
    ? unitToKg(value, draft.bodyWeightUnit ?? defaultUnit)
    : null;
}

export type BodyweightDraftIssue =
  | "invalid-added-load"
  | "missing-body-weight"
  | "nonpositive-total";

/** Validate the part of a bodyweight set that cannot be represented safely
 * by the legacy `sets.weight_kg` column. Zero/blank load without a snapshot
 * remains valid for reps-only legacy logging; a signed load needs a base. */
export function bodyweightDraftIssue(
  draft: WorkoutDraft,
  defaultUnit: Unit,
): BodyweightDraftIssue | null {
  const bodyWeightKg = draftBodyWeightKg(draft, defaultUnit);
  for (const exercise of draft.exercises) {
    if (exercise.equipment !== "bodyweight") continue;
    for (const set of exercise.sets) {
      const raw = (set.addedWeight ?? "").trim();
      if (!raw) continue;
      const added = parseSignedWeight(raw);
      if (added == null) return "invalid-added-load";
      if (bodyWeightKg == null) {
        if (added !== 0) return "missing-body-weight";
        continue;
      }
      if (bodyWeightKg + unitToKg(added, exercise.unit ?? defaultUnit) <= 0) {
        return "nonpositive-total";
      }
    }
  }
  return null;
}

/** Rebase copied/template bodyweight sets onto the new session snapshot while
 * preserving their signed added/assisted load. */
export function rebaseBodyweightExercises(
  exercises: DraftExercise[],
  bodyWeightKg: number | null,
): DraftExercise[] {
  return exercises.map((exercise) => {
    if (exercise.equipment !== "bodyweight") return exercise;
    if (bodyWeightKg == null) {
      // Never keep an invisible total from a measurement that is no longer
      // eligible for the selected workout date.
      return {
        ...exercise,
        sets: exercise.sets.map((set) => ({ ...set, weight: "" })),
      };
    }
    const bodyInUnit = kgToUnit(bodyWeightKg, exercise.unit);
    return {
      ...exercise,
      sets: exercise.sets.map((set) => {
        const added = parseSignedWeight(set.addedWeight ?? "") ?? 0;
        return {
          ...set,
          addedWeight: String(added),
          weight: String(roundWeight(bodyInUnit + added)),
        };
      }),
    };
  });
}

/** A draft with nothing worth keeping — type/date alone don't count. */
export function isDraftEmpty(draft: WorkoutDraft): boolean {
  return draft.exercises.length === 0 && draft.notes.trim() === "";
}

interface NewWorkoutDraftStore {
  draft: WorkoutDraft;
  /** Auth user that owns the persisted local draft. Never sync drafts across
   * different users sharing one browser profile. */
  ownerId: string | null;
  /** Client-stamped time of the last local edit; null until first edit.
   *  Drives cross-device last-write-wins in the draft sync. */
  updatedAt: string | null;
  setDraft: (draft: WorkoutDraft) => void;
  reset: () => void;
}

/** Persisted draft for the "new workout" flow — survives navigation
 *  and app restarts mid-session at the gym. A cloud copy is synced by
 *  `useNewWorkoutDraftSync` so the draft follows the user across devices. */
export const useNewWorkoutDraft = create<NewWorkoutDraftStore>()(
  persist(
    (set) => ({
      draft: emptyDraft(),
      ownerId: null,
      updatedAt: null,
      setDraft: (draft) =>
        set({ draft, updatedAt: new Date().toISOString() }),
      reset: () =>
        set({ draft: emptyDraft(), updatedAt: new Date().toISOString() }),
    }),
    { name: NEW_WORKOUT_DRAFT_STORAGE_KEY },
  ),
);
