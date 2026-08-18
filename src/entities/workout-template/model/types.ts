import type { Exercise } from "@/entities/exercise";

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
