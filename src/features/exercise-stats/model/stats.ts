import type { ExerciseSetRecord } from "@/entities/workout";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";

export interface WeightRepStats {
  weightKg: number;
  setCount: number;
  avgReps: number;
  medianReps: number;
  modeReps: number;
  failureRate: number; // 0..1
}

export interface ExerciseSummary {
  sessions: number;
  totalSets: number;
  totalReps: number;
  bestWeightKg: number | null;
  estOneRepMaxKg: number | null;
  lastDate: string | null;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  let best = values[0];
  let bestCount = 0;
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > bestCount || (count === bestCount && value > best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Rep statistics grouped by weight, heaviest first. */
export function repStatsByWeight(records: ExerciseSetRecord[]): WeightRepStats[] {
  const groups = new Map<number, ExerciseSetRecord[]>();
  for (const record of records) {
    if (record.weight_kg == null || record.reps == null) continue;
    const key = roundWeight(record.weight_kg);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  return [...groups.entries()]
    .map(([weightKg, sets]) => {
      const reps = sets.map((s) => s.reps!).sort((a, b) => a - b);
      return {
        weightKg,
        setCount: sets.length,
        avgReps: Math.round((reps.reduce((a, b) => a + b, 0) / reps.length) * 10) / 10,
        medianReps: median(reps),
        modeReps: mode(reps),
        failureRate: sets.filter((s) => s.to_failure).length / sets.length,
      };
    })
    .sort((a, b) => b.weightKg - a.weightKg);
}

export function exerciseSummary(records: ExerciseSetRecord[]): ExerciseSummary {
  const dates = new Set(records.map((r) => r.workoutDate));
  const weighted = records.filter((r) => r.weight_kg != null);
  const bestWeightKg = weighted.length
    ? Math.max(...weighted.map((r) => r.weight_kg!))
    : null;

  // Epley formula on the heaviest set that has reps
  let estOneRepMaxKg: number | null = null;
  for (const record of weighted) {
    if (record.reps == null || record.reps <= 0) continue;
    const est = record.weight_kg! * (1 + record.reps / 30);
    if (estOneRepMaxKg == null || est > estOneRepMaxKg) estOneRepMaxKg = est;
  }

  return {
    sessions: dates.size,
    totalSets: records.length,
    totalReps: records.reduce((sum, r) => sum + (r.reps ?? 0), 0),
    bestWeightKg,
    estOneRepMaxKg:
      estOneRepMaxKg != null ? Math.round(estOneRepMaxKg * 10) / 10 : null,
    lastDate: records.length ? records[records.length - 1].workoutDate : null,
  };
}

export interface ProgressPoint {
  date: string;
  valueKg: number;
}

/** Top-set weight per workout date — the progress line. */
export function progressSeries(records: ExerciseSetRecord[]): ProgressPoint[] {
  const byDate = new Map<string, number>();
  for (const record of records) {
    if (record.weight_kg == null) continue;
    const current = byDate.get(record.workoutDate);
    if (current == null || record.weight_kg > current) {
      byDate.set(record.workoutDate, record.weight_kg);
    }
  }
  return [...byDate.entries()]
    .map(([date, valueKg]) => ({ date, valueKg }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function seriesToUnit(series: ProgressPoint[], unit: Unit) {
  return series.map((point) => ({
    date: point.date,
    value: roundWeight(kgToUnit(point.valueKg, unit)),
  }));
}
