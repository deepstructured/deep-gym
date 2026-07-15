"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useExercises } from "@/entities/exercise";
import { useMuscleGroups } from "@/entities/muscle-group";
import type { ExerciseSetRecord, Workout } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";
import { Card, Chip, DotValue, IconChevronRight, Tag } from "@/shared/ui";
import {
  extendedSummary,
  metricSeries,
  repStatsByWeight,
  type ProgressMetric,
} from "../model/stats";
import { ProgressChart } from "./progress-chart";
import { RepsByWeightTable } from "./reps-by-weight-table";

interface ProgressExplorerProps {
  workouts: Workout[] | undefined;
  /** Profile default unit; per-exercise overrides still win. */
  unit: Unit;
}

const METRICS: ProgressMetric[] = ["topSet", "oneRm", "volume", "reps"];

/**
 * Home-screen analytics explorer: pick a muscle group, pick an exercise —
 * get the metric chart (top set / est. 1RM / volume / reps), summary tiles
 * and the reps-by-weight breakdown. Hidden until some exercise has at
 * least one logged set.
 */
export function ProgressExplorer({ workouts, unit }: ProgressExplorerProps) {
  const { t } = useI18n();
  const { data: exercises } = useExercises();
  const { data: groups } = useMuscleGroups();

  const [groupChoice, setGroupChoice] = useState<string | null>(null);
  const [exerciseChoice, setExerciseChoice] = useState<string | null>(null);
  const [metric, setMetric] = useState<ProgressMetric>("topSet");

  // Every logged set per exercise, oldest first — the shape the stats
  // helpers expect (same as useExerciseHistory, but built from the home
  // screen's already-loaded workouts).
  const recordsByExercise = useMemo(() => {
    const map = new Map<string, ExerciseSetRecord[]>();
    for (const workout of workouts ?? []) {
      for (const we of workout.workout_exercises) {
        let records = map.get(we.exercise_id);
        if (!records) {
          records = [];
          map.set(we.exercise_id, records);
        }
        for (const set of we.sets) {
          records.push({
            weight_kg: set.weight_kg,
            reps: set.reps,
            to_failure: set.to_failure,
            position: set.position,
            workoutId: workout.id,
            workoutDate: workout.date,
            workoutType: workout.type,
            exerciseNotes: we.notes,
          });
        }
      }
    }
    for (const records of map.values()) {
      records.sort(
        (a, b) =>
          a.workoutDate.localeCompare(b.workoutDate) ||
          a.position - b.position,
      );
    }
    return map;
  }, [workouts]);

  // Any exercise with at least one logged set qualifies — a single session
  // has no trend line yet, but the tiles and rep table are already useful.
  const chartable = useMemo(() => {
    const lastDates = new Map<string, string>();
    for (const [exerciseId, records] of recordsByExercise) {
      const dates = new Set(
        records
          .filter((r) => r.weight_kg != null || r.reps != null)
          .map((r) => r.workoutDate),
      );
      if (dates.size === 0) continue;
      lastDates.set(exerciseId, [...dates].sort().at(-1)!);
    }
    return (exercises ?? [])
      .filter((exercise) => lastDates.has(exercise.id))
      .sort((a, b) =>
        lastDates.get(b.id)!.localeCompare(lastDates.get(a.id)!),
      );
  }, [exercises, recordsByExercise]);

  if (chartable.length === 0) return null;

  const groupsWithData = (groups ?? []).filter((group) =>
    chartable.some((exercise) => exercise.muscle_group_id === group.id),
  );

  // Defaults follow the most recently trained exercise.
  const activeGroupId =
    groupChoice != null && groupsWithData.some((g) => g.id === groupChoice)
      ? groupChoice
      : chartable[0].muscle_group_id;

  const groupExercises = chartable.filter(
    (exercise) => exercise.muscle_group_id === activeGroupId,
  );
  const activeExercise =
    (exerciseChoice != null &&
      groupExercises.find((e) => e.id === exerciseChoice)) ||
    groupExercises[0];
  if (!activeExercise) return null;

  const records = recordsByExercise.get(activeExercise.id) ?? [];
  const exerciseUnit = activeExercise.unit ?? unit;

  const summary = extendedSummary(records);
  const repStats = repStatsByWeight(records);

  const isWeightMetric = metric !== "reps";
  const points = metricSeries(records, metric).map((point) => ({
    date: point.date,
    value: isWeightMetric
      ? roundWeight(kgToUnit(point.valueKg, exerciseUnit))
      : point.valueKg,
  }));

  const delta =
    points.length > 1
      ? Math.round(
          (points[points.length - 1].value - points[0].value) * 100,
        ) / 100
      : 0;
  const currentPoint = points.at(-1);

  const metricLabels: Record<ProgressMetric, string> = {
    topSet: t("stats.weight"),
    oneRm: t("stats.oneRm"),
    volume: t("stats.volume"),
    reps: t("stats.reps"),
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">{t("home.progress")}</h2>
        <Link
          href={`/exercises/${activeExercise.id}`}
          className="flex items-center gap-0.5 text-sm text-muted"
        >
          {t("home.details")}
          <IconChevronRight size={15} />
        </Link>
      </div>

      <Card
        variant="surface"
        className="space-y-4 border-white/[0.045] p-4"
        style={{
          background:
            "radial-gradient(125% 55% at 50% 108%, rgba(24, 39, 136, 0.13), transparent 72%), var(--color-surface)",
        }}
      >
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {groupsWithData.map((group) => (
            <Chip
              key={group.id}
              selected={group.id === activeGroupId}
              className="h-8 px-3.5 text-[13px]"
              onClick={() => {
                setGroupChoice(group.id);
                setExerciseChoice(null);
              }}
            >
              {group.name}
            </Chip>
          ))}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {groupExercises.map((exercise) => (
            <Chip
              key={exercise.id}
              selected={exercise.id === activeExercise.id}
              className="h-8 px-3.5 text-[13px]"
              onClick={() => setExerciseChoice(exercise.id)}
            >
              {exercise.name}
            </Chip>
          ))}
        </div>

        {/* Metric switcher + chart */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {METRICS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMetric(option)}
                className={
                  metric === option
                    ? "h-7 shrink-0 rounded-full bg-white px-3 text-xs font-medium text-black shadow-[0_4px_18px_-8px_rgba(255,255,255,0.8)]"
                    : "h-7 shrink-0 rounded-full border border-white/[0.05] bg-white/[0.035] px-3 text-xs font-medium text-muted"
                }
              >
                {metricLabels[option]}
              </button>
            ))}
          </div>

          <div className="flex items-end justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.12em] text-faint uppercase">
                {metricLabels[metric]}
              </p>
              <div className="mt-1 flex items-end">
                <DotValue
                  value={currentPoint?.value ?? "—"}
                  suffix={
                    currentPoint && isWeightMetric ? exerciseUnit : undefined
                  }
                  className="text-4xl text-white"
                  suffixClassName="text-white/40"
                />
              </div>
            </div>
            {delta !== 0 && (
              <Tag
                tone={delta > 0 ? "lime" : undefined}
                className="mb-1 shrink-0"
              >
                {delta > 0 ? "+" : ""}
                {delta}
                {isWeightMetric ? ` ${exerciseUnit}` : ""}
              </Tag>
            )}
          </div>

          <ProgressChart
            points={points}
            unit={isWeightMetric ? exerciseUnit : ""}
          />
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-2">
          <MiniStat
            label={t("detail.bestWeight")}
            value={
              summary.bestWeightKg != null
                ? roundWeight(kgToUnit(summary.bestWeightKg, exerciseUnit))
                : "—"
            }
            suffix={summary.bestWeightKg != null ? exerciseUnit : undefined}
          />
          <MiniStat
            label={t("detail.est1rm")}
            value={
              summary.estOneRepMaxKg != null
                ? roundWeight(kgToUnit(summary.estOneRepMaxKg, exerciseUnit))
                : "—"
            }
            suffix={summary.estOneRepMaxKg != null ? exerciseUnit : undefined}
          />
          <MiniStat label={t("detail.sessions")} value={summary.sessions} />
          <MiniStat label={t("detail.totalSets")} value={summary.totalSets} />
          <MiniStat label={t("stats.totalReps")} value={summary.totalReps} />
          <MiniStat
            label={t("stats.volume")}
            value={formatThousands(
              Math.round(kgToUnit(summary.totalVolumeKg, exerciseUnit)),
            )}
            suffix={exerciseUnit}
          />
          <MiniStat
            label={t("stats.failRate")}
            value={`${Math.round(summary.failureRate * 100)}%`}
          />
          <MiniStat
            label={t("stats.perWeek")}
            value={summary.perWeek ?? "—"}
            suffix={summary.perWeek != null ? "×" : undefined}
          />
        </div>

        {/* Reps by weight */}
        {repStats.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-muted">
              {t("detail.repsByWeight")}
            </p>
            <RepsByWeightTable
              stats={repStats}
              unit={exerciseUnit}
              maxRows={6}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function MiniStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="rounded-tile bg-white/[0.035] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <p className="mb-1 text-[10px] font-medium tracking-wide text-faint uppercase">
        {label}
      </p>
      <DotValue value={value} suffix={suffix} className="text-xl" />
    </div>
  );
}

/** 12345 → "12 345" (narrow no-break spaces). */
function formatThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
