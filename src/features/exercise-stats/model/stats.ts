import { differenceInCalendarDays } from "date-fns";
import { bodyweightLoadFromTotal } from "@/entities/body-weight";
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
  /** Best signed external load for a body-weight exercise. A negative value
   * represents assistance. Null means no workout body-weight snapshot exists. */
  bestAddedLoadKg: number | null;
  estOneRepMaxKg: number | null;
  lastDate: string | null;
}

export type ExerciseLoadMode = "external" | "bodyweight";

export interface ExerciseStatsOptions {
  loadMode?: ExerciseLoadMode;
}

/** Signed external load for a body-weight set. `sets.weight_kg` remains the
 * total effective load, so legacy records without a workout snapshot cannot
 * be split reliably and intentionally return null. */
export function addedLoadForRecord(
  record: Pick<ExerciseSetRecord, "weight_kg" | "body_weight_kg">,
): number | null {
  if (record.weight_kg == null || record.body_weight_kg == null) return null;
  return bodyweightLoadFromTotal(
    record.weight_kg,
    record.body_weight_kg,
  ).addedLoadKg;
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

/** Rep statistics grouped by total weight or, for body-weight exercises, by
 * signed added load. Body-weight legacy records without snapshots are skipped
 * because their added load cannot be recovered. */
export function repStatsByWeight(
  records: ExerciseSetRecord[],
  options: ExerciseStatsOptions = {},
): WeightRepStats[] {
  const groups = new Map<number, ExerciseSetRecord[]>();
  for (const record of records) {
    if (record.reps == null) continue;
    const loadKg =
      options.loadMode === "bodyweight"
        ? addedLoadForRecord(record)
        : record.weight_kg;
    if (loadKg == null) continue;
    const key = roundWeight(loadKg);
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

export function exerciseSummary(
  records: ExerciseSetRecord[],
  options: ExerciseStatsOptions = {},
): ExerciseSummary {
  const dates = new Set(records.map((r) => r.workoutDate));
  const isBodyweight = options.loadMode === "bodyweight";
  const weighted = isBodyweight
    ? []
    : records.filter((r) => r.weight_kg != null);
  const addedLoads = isBodyweight
    ? records
        .map(addedLoadForRecord)
        .filter((value): value is number => value != null)
    : [];
  const bestWeightKg = weighted.length
    ? Math.max(...weighted.map((r) => r.weight_kg!))
    : null;
  const bestAddedLoadKg = addedLoads.length ? Math.max(...addedLoads) : null;

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
    bestAddedLoadKg,
    estOneRepMaxKg:
      estOneRepMaxKg != null ? Math.round(estOneRepMaxKg * 10) / 10 : null,
    lastDate: records.length ? records[records.length - 1].workoutDate : null,
  };
}

export interface ProgressPoint {
  date: string;
  valueKg: number;
}

/** Top-set total weight, or signed added load for body-weight exercises, per
 * workout date. Legacy body-weight records without snapshots are omitted. */
export function progressSeries(
  records: ExerciseSetRecord[],
  options: ExerciseStatsOptions = {},
): ProgressPoint[] {
  const byDate = new Map<string, number>();
  for (const record of records) {
    const loadKg =
      options.loadMode === "bodyweight"
        ? addedLoadForRecord(record)
        : record.weight_kg;
    if (loadKg == null) continue;
    const current = byDate.get(record.workoutDate);
    if (current == null || loadKg > current) {
      byDate.set(record.workoutDate, loadKg);
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

/** What the progress chart plots per session. */
export type ProgressMetric =
  | "topSet"
  | "oneRm"
  | "volume"
  | "reps"
  | "addedLoad";

/** Per-session series for a metric. Values are kg for weight metrics and
 *  plain counts for "reps" — the caller converts units where relevant. */
export function metricSeries(
  records: ExerciseSetRecord[],
  metric: ProgressMetric,
): ProgressPoint[] {
  const byDate = new Map<string, number>();
  for (const record of records) {
    const date = record.workoutDate;
    switch (metric) {
      case "topSet": {
        if (record.weight_kg == null) break;
        const current = byDate.get(date);
        if (current == null || record.weight_kg > current) {
          byDate.set(date, record.weight_kg);
        }
        break;
      }
      case "oneRm": {
        if (record.weight_kg == null || record.reps == null || record.reps <= 0)
          break;
        const est = record.weight_kg * (1 + record.reps / 30); // Epley
        const current = byDate.get(date);
        if (current == null || est > current) byDate.set(date, est);
        break;
      }
      case "volume": {
        if (record.weight_kg == null || record.reps == null) break;
        byDate.set(
          date,
          (byDate.get(date) ?? 0) + record.weight_kg * record.reps,
        );
        break;
      }
      case "reps": {
        if (record.reps == null) break;
        byDate.set(date, (byDate.get(date) ?? 0) + record.reps);
        break;
      }
      case "addedLoad": {
        const addedLoadKg = addedLoadForRecord(record);
        if (addedLoadKg == null) break;
        const current = byDate.get(date);
        if (current == null || addedLoadKg > current) {
          byDate.set(date, addedLoadKg);
        }
        break;
      }
    }
  }
  return [...byDate.entries()]
    .map(([date, valueKg]) => ({ date, valueKg }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface ExtendedSummary extends ExerciseSummary {
  /** Sum of weight × reps over the period, kg. Null for body-weight exercises:
   * total effective load is not comparable to external-load volume. */
  totalVolumeKg: number | null;
  /** Share of sets marked "to failure", 0..1. */
  failureRate: number;
  /** Average sessions per week over the active span; null with no sessions. */
  perWeek: number | null;
  firstDate: string | null;
}

export function extendedSummary(
  records: ExerciseSetRecord[],
  options: ExerciseStatsOptions = {},
): ExtendedSummary {
  const base = exerciseSummary(records, options);
  const dates = [...new Set(records.map((r) => r.workoutDate))].sort();
  const firstDate = dates[0] ?? null;

  let totalVolumeKg = 0;
  let failures = 0;
  for (const record of records) {
    if (record.weight_kg != null && record.reps != null) {
      totalVolumeKg += record.weight_kg * record.reps;
    }
    if (record.to_failure) failures += 1;
  }

  let perWeek: number | null = null;
  if (firstDate && base.lastDate) {
    const spanDays = Math.max(
      7,
      differenceInCalendarDays(
        new Date(base.lastDate),
        new Date(firstDate),
      ) + 1,
    );
    perWeek = Math.round((base.sessions / (spanDays / 7)) * 10) / 10;
  }

  return {
    ...base,
    totalVolumeKg:
      options.loadMode === "bodyweight" ? null : totalVolumeKg,
    failureRate: records.length ? failures / records.length : 0,
    perWeek,
    firstDate,
  };
}
