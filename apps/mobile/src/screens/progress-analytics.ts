import { exerciseSummary, type ExerciseSetRecord } from "../data/exercise-detail";

export type LoadFilter =
  | { mode: "all" }
  | { mode: "working" }
  | { mode: "weight"; weightKg: number };

/** Match the PWA's rolling working weight: 85% of the highest load in the
 * current and preceding four sessions. Warm-ups never count. */
export function filterByLoad(records: ExerciseSetRecord[], filter: LoadFilter): ExerciseSetRecord[] {
  const working = records.filter((record) => record.set_type !== "warmup");
  if (filter.mode === "all") return working;
  if (filter.mode === "weight") {
    return working.filter((record) =>
      record.weight_kg != null && Math.abs(record.weight_kg - filter.weightKg) < 0.05,
    );
  }

  const topByDate = new Map<string, number>();
  for (const record of working) {
    if (record.weight_kg == null) continue;
    const prior = topByDate.get(record.workoutDate);
    if (prior == null || record.weight_kg > prior) topByDate.set(record.workoutDate, record.weight_kg);
  }
  const dates = [...topByDate.keys()].sort();
  const thresholdByDate = new Map<string, number>();
  dates.forEach((date, index) => {
    const window = dates.slice(Math.max(0, index - 4), index + 1);
    thresholdByDate.set(date, Math.max(...window.map((day) => topByDate.get(day)!)) * 0.85);
  });
  return working.filter((record) =>
    record.weight_kg != null && record.weight_kg >= thresholdByDate.get(record.workoutDate)! - 1e-9,
  );
}

/** The eight most used exact loads, sorted from heaviest to lightest. */
export function loadOptions(records: ExerciseSetRecord[]): number[] {
  const counts = new Map<number, number>();
  for (const record of records) {
    if (record.set_type === "warmup" || record.weight_kg == null) continue;
    const key = Math.round(record.weight_kg * 100) / 100;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([weight]) => weight)
    .sort((a, b) => b - a);
}

function calendarDayNumber(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function progressSummary(records: ExerciseSetRecord[], bodyweight: boolean) {
  const base = exerciseSummary(records, bodyweight);
  const working = records.filter((record) => record.set_type !== "warmup");
  const dates = [...new Set(working.map((record) => record.workoutDate))].sort();
  const first = dates[0];
  const last = dates.at(-1);
  const spanDays = first && last ? Math.max(7, calendarDayNumber(last) - calendarDayNumber(first) + 1) : null;
  return {
    ...base,
    totalVolumeKg: bodyweight ? null : working.reduce((sum, record) =>
      sum + (record.weight_kg ?? 0) * (record.reps ?? 0), 0),
    failureRate: working.length ? working.filter((record) => record.to_failure).length / working.length : 0,
    perWeek: spanDays ? Math.round(base.sessions / (spanDays / 7) * 10) / 10 : null,
  };
}
