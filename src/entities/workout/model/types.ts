import type { Exercise } from "@/entities/exercise";
import type { ExerciseLoadMode } from "@/shared/config/workout";

export interface WorkoutSet {
  id: string;
  workout_exercise_id: string;
  position: number;
  weight_kg: number | null;
  reps: number | null;
  to_failure: boolean;
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
    }[];
  }[];
}
