export const WEEKDAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

export type WeekdayIndex = (typeof WEEKDAY_INDICES)[number];

/** Monday → Sunday. A null slot is a rest day. */
export type TrainingSchedule = [
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
];

export function emptyTrainingSchedule(): TrainingSchedule {
  return [null, null, null, null, null, null, null];
}

/** Safely read the Postgres array, including profiles created before the
 *  schedule migration was applied. */
export function normalizeTrainingSchedule(value: unknown): TrainingSchedule {
  if (!Array.isArray(value)) return emptyTrainingSchedule();
  return WEEKDAY_INDICES.map((weekday) => {
    const type = value[weekday];
    return typeof type === "string" && type.trim() ? type.trim() : null;
  }) as TrainingSchedule;
}

/** Persist an entirely empty week as NULL — no schedule is the default. */
export function scheduleForStorage(
  value: TrainingSchedule,
): TrainingSchedule | null {
  const normalized = normalizeTrainingSchedule(value);
  return normalized.some(Boolean) ? normalized : null;
}
