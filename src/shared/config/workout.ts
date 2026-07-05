export const BASE_WORKOUT_TYPES = [
  "Upper",
  "Lower",
  "Full Body",
  "Push",
  "Pull",
] as const;

export const EQUIPMENT_OPTIONS = [
  { value: "free_weight", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "machine", label: "Machine" },
  { value: "crossover", label: "Crossover" },
] as const;

export type Equipment = (typeof EQUIPMENT_OPTIONS)[number]["value"];

export function equipmentLabel(value: Equipment): string {
  return EQUIPMENT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export const DEFAULT_PLATES_KG = [30, 25, 20, 15, 10, 5, 2.5, 2, 1.25];
export const DEFAULT_BAR_KG = 20;
