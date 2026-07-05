import type { Equipment } from "@/shared/config/workout";
import type { Unit } from "@/shared/lib/weight";

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
