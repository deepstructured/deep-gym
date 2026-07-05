import type { Exercise } from "@/entities/exercise";

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
  exercise: Exercise;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  user_id: string;
  type: string;
  date: string; // yyyy-MM-dd
  notes: string | null;
  created_at: string;
  workout_exercises: WorkoutExercise[];
}

/** Input shape used by create/update mutations. */
export interface WorkoutInput {
  type: string;
  date: string;
  notes: string | null;
  exercises: {
    exercise_id: string;
    notes: string | null;
    sets: {
      weight_kg: number | null;
      reps: number | null;
      to_failure: boolean;
    }[];
  }[];
}
