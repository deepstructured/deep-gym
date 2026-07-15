import type { TrainingSchedule } from "@/entities/user";

export type TrainingWeekPresetId = "twoDays" | "threeDays" | "fourDays";

export interface TrainingWeekPreset {
  id: TrainingWeekPresetId;
  dayCount: 2 | 3 | 4;
  value: TrainingSchedule;
}

/**
 * Ready-to-use schedules for onboarding and other guided setup flows.
 * Labels stay with the consuming UI so they can be translated in context.
 */
export const TRAINING_WEEK_PRESETS: readonly TrainingWeekPreset[] = [
  {
    id: "twoDays",
    dayCount: 2,
    value: ["Upper", null, null, "Lower", null, null, null],
  },
  {
    id: "threeDays",
    dayCount: 3,
    value: ["Full Body", null, "Full Body", null, "Full Body", null, null],
  },
  {
    id: "fourDays",
    dayCount: 4,
    value: ["Upper", "Lower", null, "Upper", "Lower", null, null],
  },
];

export function hasIncompleteTrainingDays(value: TrainingSchedule): boolean {
  return value.some((type) => type !== null && type.trim().length === 0);
}
