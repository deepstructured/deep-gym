export const BASE_WORKOUT_TYPES = [
  "Upper",
  "Lower",
  "Full Body",
  "Push",
  "Pull",
] as const;

// Labels live in the i18n dictionary: t(`equipment.${value}`)
export const EQUIPMENT_OPTIONS = [
  { value: "free_weight" },
  { value: "dumbbell" },
  { value: "machine" },
  { value: "crossover" },
] as const;

export type Equipment = (typeof EQUIPMENT_OPTIONS)[number]["value"];

export const DEFAULT_PLATES_KG = [30, 25, 20, 15, 10, 5, 2.5, 2, 1.25];
export const DEFAULT_BAR_KG = 20;
