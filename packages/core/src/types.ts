import type { Equipment, ExerciseLoadMode, SetType } from "./workout";
import type { TrainingSchedule } from "./training-schedule";
import type { Unit } from "./weight";
import type { Lang } from "./i18n";

export interface MuscleGroup {
  id: string;
  user_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  unit: Unit;
  bar_weight_kg: number;
  /** Plate denominations in kg (20, 10, 5…). */
  plates_kg: number[];
  /** Plate denominations in lb (45, 25, 10…). */
  plates_lb: number[];
  /** Interface language; defaults to English. */
  language: Lang | null;
  /** Custom avatar (public storage URL); null = default avatar. */
  avatar_url: string | null;
  /** Monday → Sunday; null until the user configures their training week. */
  training_schedule: TrainingSchedule | null;
  /** Cached newest body-weight measurement, always stored in kg. */
  body_weight_kg: number | null;
  /** Timestamp belonging to body_weight_kg; both cache fields are nullable. */
  body_weight_measured_at: string | null;
  /** Latest onboarding flow version completed by the user; 0 = incomplete. */
  onboarding_version: number;
  /** When the latest onboarding flow was completed. */
  onboarding_completed_at: string | null;
  /** Latest product release announcement acknowledged by the user. */
  last_seen_release_version: number;
  /** Customized home layout (validated by the home dashboard); null = the
   *  default. Absent until migration 0008 is applied. */
  home_widgets?: unknown;
  telegram_id: number | null;
  telegram_username: string | null;
  created_at: string;
}

export interface Exercise {
  id: string;
  user_id: string;
  muscle_group_id: string;
  name: string;
  equipment: Equipment;
  machine_settings: string | null;
  working_weight_kg: number | null;
  /** Display-unit override; null = use the profile default. */
  unit: Unit | null;
  created_at: string;
}

export interface ExerciseInput {
  name: string;
  muscle_group_id: string;
  equipment: Equipment;
  machine_settings?: string | null;
  working_weight_kg?: number | null;
  unit?: Unit | null;
}

export interface WorkoutSet {
  id: string;
  workout_exercise_id: string;
  position: number;
  weight_kg: number | null;
  reps: number | null;
  to_failure: boolean;
  /** Missing until migration 0008 is applied; treat as "working". */
  set_type?: SetType;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  notes: string | null;
  /** Immutable load-semantics snapshot for this logged occurrence. */
  load_mode: ExerciseLoadMode;
  exercise: Exercise;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  user_id: string;
  type: string;
  date: string; // yyyy-MM-dd
  notes: string | null;
  /** Body-weight snapshot for this session, always stored in kg. */
  body_weight_kg: number | null;
  created_at: string;
  workout_exercises: WorkoutExercise[];
}

/** Input shape used by create/update mutations. */
export interface WorkoutInput {
  type: string;
  date: string;
  notes: string | null;
  /** Optional during the staged rollout so legacy drafts remain saveable.
   *  When present, this is the session snapshot in canonical kg. */
  body_weight_kg?: number | null;
  exercises: {
    exercise_id: string;
    /** Expected current mode; the database rejects stale drafts. */
    load_mode: ExerciseLoadMode;
    notes: string | null;
    sets: {
      weight_kg: number | null;
      reps: number | null;
      to_failure: boolean;
      set_type: SetType;
    }[];
  }[];
}

export interface WorkoutTemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  position: number;
  exercise: Exercise;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
  workout_template_exercises: WorkoutTemplateExercise[];
}

export interface WorkoutTemplateSummary {
  id: string;
  user_id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
  exerciseCount: number;
}

export interface WorkoutTemplateInput {
  name: string;
  type: string;
  /** Exercise IDs in their intended workout order. */
  exerciseIds: string[];
}
