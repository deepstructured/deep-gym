export const BASE_WORKOUT_TYPES = [
  "Upper",
  "Lower",
  "Full Body",
  "Push",
  "Pull",
] as const;

type DraftContents = { notes: string; exercises: readonly unknown[] };

export function isWorkoutDraftEmpty(draft: DraftContents): boolean {
  return draft.exercises.length === 0 && draft.notes.trim() === "";
}

/** A reset can stay in device or cloud storage for weeks. Its creation day
 * only becomes the workout day when the athlete selects it or starts logging. */
export function resolveWorkoutDraftDate(
  draft: DraftContents & { date: string; dateExplicit?: boolean },
  localToday: string,
): string {
  return draft.dateExplicit || !isWorkoutDraftEmpty(draft) ? draft.date : localToday;
}

/** A legacy draft with logged work already has a venue: no gym. Only a fresh
 * draft inherits the profile, and an explicit null remains an active choice. */
export function resolveWorkoutDraftGym(draft: DraftContents & { gymId?: string | null }, preferred: string | null) {
  if (draft.gymId !== undefined) return draft.gymId;
  return isWorkoutDraftEmpty(draft) ? preferred : null;
}

// Labels live in the i18n dictionary: t(`equipment.${value}`)
export const EQUIPMENT_OPTIONS = [
  { value: "free_weight" },
  { value: "dumbbell" },
  { value: "machine" },
  { value: "crossover" },
  { value: "bodyweight" },
] as const;

export type Equipment = (typeof EQUIPMENT_OPTIONS)[number]["value"];

/** Persisted load semantics for a workout exercise. External equipment types
 * can change among themselves without reinterpreting historical set weight. */
export type ExerciseLoadMode = "external" | "bodyweight";

export function equipmentLoadMode(equipment: Equipment): ExerciseLoadMode {
  return equipment === "bodyweight" ? "bodyweight" : "external";
}

/** Kind of logged set. Warm-ups are stored and shown with the workout but
 * never count toward progress statistics. */
export type SetType = "working" | "warmup";

/** Rows written before migration 0008 have no set_type — they are working. */
export function isWarmupSet(set: { set_type?: string | null }): boolean {
  return set.set_type === "warmup";
}

export const DEFAULT_PLATES_KG = [30, 25, 20, 15, 10, 5, 2.5, 2, 1.25];
export const DEFAULT_BAR_KG = 20;
export const DEFAULT_PLATES_LB = [45, 35, 25, 10, 5, 2.5];
export const DEFAULT_BAR_LB = 45;
