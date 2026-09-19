import { differenceInCalendarDays } from "date-fns";
import { bodyweightLoadFromTotal } from "@/entities/body-weight";
import type { ExerciseSetRecord } from "@/entities/workout";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";

/** Warm-ups are logged for the record but never count as progress. */
export function isWorkingRecord(
  record: Pick<ExerciseSetRecord, "set_type">,
): boolean {
  return record.set_type !== "warmup";
}

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
  for (const record of records.filter(isWorkingRecord)) {
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
  allRecords: ExerciseSetRecord[],
  options: ExerciseStatsOptions = {},
): ExerciseSummary {
  const records = allRecords.filter(isWorkingRecord);
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

/** What the progress chart plots per session. */
export type ProgressMetric =
  | "topSet"
  | "oneRm"
  | "volume"
  | "reps"
  | "addedLoad";

/** Which working sets a progress view counts. */
export type LoadFilter =
  | { mode: "all" }
  /** Sets near the working weight *at that time* (see filterByLoad). */
  | { mode: "working" }
  /** Only sets at exactly this load. */
  | { mode: "weight"; weightKg: number };

export type LoadFilterMode = "all" | "working";

/** A set counts as working at ≥ 85% of the heaviest load of the last five
 *  sessions (including the current one). */
const WORKING_SHARE = 0.85;
const WORKING_LOOKBACK = 5;

/**
 * Working sets under a load filter, warm-ups always excluded.
 *
 * "working" drops light days and back-off sets — e.g. a pump session at
 * 20 kg × 24 while the working weight is 27.5 kg — which would otherwise
 * spike volume and reps. The reference follows history, so older sessions
 * are judged against the weight that was working back then.
 */
export function filterByLoad(
  records: ExerciseSetRecord[],
  filter: LoadFilter,
): ExerciseSetRecord[] {
  const working = records.filter(isWorkingRecord);
  if (filter.mode === "all") return working;
  if (filter.mode === "weight") {
    return working.filter(
      (record) =>
        record.weight_kg != null &&
        Math.abs(record.weight_kg - filter.weightKg) < 0.05,
    );
  }

  const topByDate = new Map<string, number>();
  for (const record of working) {
    if (record.weight_kg == null) continue;
    const top = topByDate.get(record.workoutDate);
    if (top == null || record.weight_kg > top) {
      topByDate.set(record.workoutDate, record.weight_kg);
    }
  }
  const dates = [...topByDate.keys()].sort();
  const thresholdByDate = new Map<string, number>();
  dates.forEach((date, index) => {
    const window = dates.slice(
      Math.max(0, index - WORKING_LOOKBACK + 1),
      index + 1,
    );
    const reference = Math.max(...window.map((day) => topByDate.get(day)!));
    thresholdByDate.set(date, reference * WORKING_SHARE);
  });
  return working.filter(
    (record) =>
      record.weight_kg != null &&
      record.weight_kg >= thresholdByDate.get(record.workoutDate)! - 1e-9,
  );
}

export interface LoadOption {
  weightKg: number;
  sets: number;
}

/** The loads worth filtering by: the most used ones, heaviest first. */
export function loadOptions(
  records: ExerciseSetRecord[],
  limit = 8,
): LoadOption[] {
  const counts = new Map<number, number>();
  for (const record of records) {
    if (!isWorkingRecord(record) || record.weight_kg == null) continue;
    const key = Math.round(record.weight_kg * 100) / 100;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([weightKg, sets]) => ({ weightKg, sets }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, limit)
    .sort((a, b) => b.weightKg - a.weightKg);
}

/** Trailing moving average over `window` sessions (fewer at the start). */
export function movingAverage(values: number[], window = 3): number[] {
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - window + 1), index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

export interface ProgressPoint {
  date: string;
  /** kg for weight metrics, a plain count for "reps". */
  valueKg: number;
  /** Working sets logged for the exercise that session. */
  sets: number;
  /** Total reps over those sets. */
  reps: number;
  /** The set behind the value — the top set, the best 1RM set or, for
   *  session totals, the heaviest set. */
  best: { weightKg: number | null; reps: number | null } | null;
}

function epley(weightKg: number, reps: number) {
  return weightKg * (1 + reps / 30);
}

/** Per-session series for a metric, oldest first. Warm-ups are skipped. */
export function metricSeries(
  records: ExerciseSetRecord[],
  metric: ProgressMetric,
): ProgressPoint[] {
  const byDate = new Map<string, ExerciseSetRecord[]>();
  for (const record of records) {
    if (!isWorkingRecord(record)) continue;
    const list = byDate.get(record.workoutDate);
    if (list) list.push(record);
    else byDate.set(record.workoutDate, [record]);
  }

  const points: ProgressPoint[] = [];
  for (const [date, sets] of byDate) {
    let value: number | null = null;
    let best: ExerciseSetRecord | null = null;
    const reps = sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
    const heaviest = sets.reduce<ExerciseSetRecord | null>(
      (top, set) =>
        set.weight_kg != null &&
        (top?.weight_kg == null || set.weight_kg > top.weight_kg)
          ? set
          : top,
      null,
    );

    for (const set of sets) {
      switch (metric) {
        case "topSet":
          if (
            set.weight_kg != null &&
            (value == null ||
              set.weight_kg > value ||
              (set.weight_kg === value && (set.reps ?? 0) > (best?.reps ?? 0)))
          ) {
            value = set.weight_kg;
            best = set;
          }
          break;
        case "oneRm":
          if (set.weight_kg != null && set.reps != null && set.reps > 0) {
            const estimate = epley(set.weight_kg, set.reps);
            if (value == null || estimate > value) {
              value = estimate;
              best = set;
            }
          }
          break;
        case "volume":
          if (set.weight_kg != null && set.reps != null) {
            value = (value ?? 0) + set.weight_kg * set.reps;
            best = heaviest;
          }
          break;
        case "reps":
          if (set.reps != null) {
            value = (value ?? 0) + set.reps;
            if (best == null || set.reps > (best.reps ?? 0)) best = set;
          }
          break;
        case "addedLoad": {
          const added = addedLoadForRecord(set);
          if (added != null && (value == null || added > value)) {
            value = added;
            best = set;
          }
          break;
        }
      }
    }

    if (value != null) {
      points.push({
        date,
        valueKg: value,
        sets: sets.length,
        reps,
        best: best ? { weightKg: best.weight_kg, reps: best.reps } : null,
      });
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** Indices of sessions that beat every earlier session (all-time PRs). The
 *  first session only sets the baseline. */
export function recordIndices(values: number[]): Set<number> {
  const result = new Set<number>();
  let max = -Infinity;
  values.forEach((value, index) => {
    if (index > 0 && value > max + 1e-9) result.add(index);
    max = Math.max(max, value);
  });
  return result;
}

export interface SeriesSummary {
  first: number;
  last: number;
  change: number;
  /** Relative change vs the first value; null when it started at zero. */
  changePct: number | null;
  best: number;
  average: number;
  /** Least-squares slope expressed per 30 days; null under two sessions. */
  perMonth: number | null;
  sessions: number;
}

/** Headline numbers of a (period-filtered) display-unit series. */
export function summarizeSeries(
  points: { date: string; value: number }[],
): SeriesSummary | null {
  if (points.length === 0) return null;
  const values = points.map((point) => point.value);
  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;

  let perMonth: number | null = null;
  if (points.length >= 2) {
    const t = points.map(
      (point) => new Date(point.date).getTime() / 86_400_000,
    );
    const meanT = t.reduce((sum, value) => sum + value, 0) / t.length;
    const meanV = values.reduce((sum, value) => sum + value, 0) / values.length;
    let num = 0;
    let den = 0;
    t.forEach((time, index) => {
      num += (time - meanT) * (values[index] - meanV);
      den += (time - meanT) ** 2;
    });
    perMonth = den > 0 ? (num / den) * 30 : null;
  }

  return {
    first,
    last,
    change,
    changePct: first !== 0 ? (change / Math.abs(first)) * 100 : null,
    best: Math.max(...values),
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    perMonth,
    sessions: points.length,
  };
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
  allRecords: ExerciseSetRecord[],
  options: ExerciseStatsOptions = {},
): ExtendedSummary {
  const records = allRecords.filter(isWorkingRecord);
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
