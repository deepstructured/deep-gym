import type { WorkoutInput } from "@deepgym/core/types";
import { equipmentLoadMode } from "@deepgym/core/workout";
import {
  parseSignedWeight,
  parseWeight,
  unitToKg,
  type Unit,
} from "@deepgym/core/weight";
import type { WorkoutDraft } from "./draft";

function kg2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Keep exactly the PWA's canonical kg and bodyweight snapshot semantics. */
export function draftToInput(draft: WorkoutDraft, defaultUnit: Unit): WorkoutInput {
  const bodyWeight = parseWeight(draft.bodyWeight ?? "");
  const bodyWeightKg = bodyWeight == null
    ? null
    : kg2(unitToKg(bodyWeight, draft.bodyWeightUnit ?? defaultUnit));

  return {
    type: draft.type.trim() || "Workout",
    date: draft.date,
    notes: draft.notes.trim() || null,
    body_weight_kg: bodyWeightKg,
    exercises: draft.exercises.map((exercise) => ({
      exercise_id: exercise.exerciseId,
      load_mode: equipmentLoadMode(exercise.equipment),
      notes: exercise.notes.trim() || null,
      sets: exercise.sets.map((set) => {
        const unit = exercise.unit ?? defaultUnit;
        const weight = parseWeight(set.weight);
        const added = parseSignedWeight(set.addedWeight ?? "") ?? 0;
        const reps = parseInt(set.reps, 10);
        const totalBodyweightKg = exercise.equipment === "bodyweight" && bodyWeightKg != null
          ? bodyWeightKg + unitToKg(added, unit)
          : null;
        return {
          weight_kg: totalBodyweightKg != null && totalBodyweightKg > 0
            ? kg2(totalBodyweightKg)
            : weight == null ? null : kg2(unitToKg(weight, unit)),
          reps: Number.isFinite(reps) && reps > 0 ? reps : null,
          to_failure: set.warmup ? false : set.toFailure,
          set_type: set.warmup ? "warmup" as const : "working" as const,
        };
      }),
    })),
  };
}

export type BodyweightDraftIssue = "invalid-added-load" | "missing-body-weight" | "nonpositive-total";

export function bodyweightDraftError(draft: WorkoutDraft, defaultUnit: Unit): BodyweightDraftIssue | null {
  const bodyWeight = parseWeight(draft.bodyWeight ?? "");
  const bodyWeightKg = bodyWeight == null
    ? null
    : unitToKg(bodyWeight, draft.bodyWeightUnit ?? defaultUnit);
  for (const exercise of draft.exercises) {
    if (exercise.equipment !== "bodyweight") continue;
    for (const set of exercise.sets) {
      const raw = (set.addedWeight ?? "").trim();
      if (!raw) continue;
      const added = parseSignedWeight(raw);
      if (added == null) return "invalid-added-load";
      if (bodyWeightKg == null && added !== 0) return "missing-body-weight";
      if (bodyWeightKg != null && bodyWeightKg + unitToKg(added, exercise.unit ?? defaultUnit) <= 0) {
        return "nonpositive-total";
      }
    }
  }
  return null;
}
