import type { Unit } from "@/shared/lib/weight";

export interface Profile {
  id: string;
  display_name: string | null;
  unit: Unit;
  bar_weight_kg: number;
  /** Plate denominations in kg (20, 10, 5…). */
  plates_kg: number[];
  /** Plate denominations in lb (45, 25, 10…). */
  plates_lb: number[];
  telegram_id: number | null;
  telegram_username: string | null;
  created_at: string;
}
