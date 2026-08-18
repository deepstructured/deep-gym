"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useExercises } from "@/entities/exercise";
import { useMuscleGroups } from "@/entities/muscle-group";
import type { ExerciseSetRecord, Workout } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";
import { cn } from "@/shared/lib/cn";
import { Card, Chip, DotValue, IconChevronRight, Tag } from "@/shared/ui";
import {
  extendedSummary,
  metricSeries,
  repStatsByWeight,
  type ProgressMetric,
} from "../model/stats";
import { ProgressChart } from "./progress-chart";
import { RepsByWeightTable } from "./reps-by-weight-table";
import styles from "./progress-explorer.module.scss";

interface ProgressExplorerProps {
  workouts: Workout[] | undefined;
  /** Profile default unit; per-exercise overrides still win. */
  unit: Unit;
}

const EXTERNAL_METRICS: ProgressMetric[] = [
  "topSet",
  "oneRm",
  "volume",
  "reps",
];
const BODYWEIGHT_METRICS: ProgressMetric[] = ["reps", "addedLoad"];

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
            body_weight_kg: workout.body_weight_kg ?? null,
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
  const isBodyweight = activeExercise.equipment === "bodyweight";
  const loadMode = isBodyweight ? "bodyweight" : "external";
  const metrics = isBodyweight ? BODYWEIGHT_METRICS : EXTERNAL_METRICS;
  const activeMetric = metrics.includes(metric) ? metric : metrics[0];

  const summary = extendedSummary(records, { loadMode });
  const repStats = repStatsByWeight(records, { loadMode });

  const isWeightMetric = activeMetric !== "reps";
  const points = metricSeries(records, activeMetric).map((point) => ({
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
    addedLoad: t("stats.addedLoad"),
  };

  return (
    <div>
      <div className={styles.headerRow}>
        <h2 className={styles.heading}>{t("home.progress")}</h2>
        <Link
          href={`/exercises/${activeExercise.id}`}
          className={styles.detailsLink}
        >
          {t("home.details")}
          <IconChevronRight size={15} />
        </Link>
      </div>

      <Card variant="surface" className={styles.card}>
        <div className={cn(styles.chipRow, "no-scrollbar")}>
          {groupsWithData.map((group) => (
            <Chip
              key={group.id}
              selected={group.id === activeGroupId}
              className={styles.smallChip}
              onClick={() => {
                setGroupChoice(group.id);
                setExerciseChoice(null);
              }}
            >
              {group.name}
            </Chip>
          ))}
        </div>

        <div className={cn(styles.chipRow, "no-scrollbar")}>
          {groupExercises.map((exercise) => (
            <Chip
              key={exercise.id}
              selected={exercise.id === activeExercise.id}
              className={styles.smallChip}
              onClick={() => setExerciseChoice(exercise.id)}
            >
              {exercise.name}
            </Chip>
          ))}
        </div>

        {/* Metric switcher + chart */}
        <div className={styles.metricSection}>
          <div className={styles.metricButtons}>
            {metrics.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMetric(option)}
                className={cn(
                  styles.metricButton,
                  activeMetric === option && styles.metricButtonActive,
                )}
              >
                {metricLabels[option]}
              </button>
            ))}
          </div>

          <div className={styles.valueRow}>
            <div className={styles.valueText}>
              <p className={styles.valueLabel}>
                {metricLabels[activeMetric]}
              </p>
              <div className={styles.valueDisplay}>
                <DotValue
                  value={
                    currentPoint && activeMetric === "addedLoad"
                      ? formatSignedValue(currentPoint.value)
                      : currentPoint?.value ?? "—"
                  }
                  suffix={
                    currentPoint && isWeightMetric ? exerciseUnit : undefined
                  }
                  className={styles.valueNumber}
                  suffixClassName={styles.valueSuffix}
                />
              </div>
            </div>
            {delta !== 0 && (
              <Tag
                tone={delta > 0 ? "lime" : undefined}
                className={styles.deltaTag}
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
            signed={activeMetric === "addedLoad"}
          />
        </div>

        {/* Summary tiles */}
        <div className={styles.statGrid}>
          {isBodyweight ? (
            <MiniStat
              label={t("detail.bestAddedLoad")}
              value={formatSignedWeight(summary.bestAddedLoadKg, exerciseUnit)}
              suffix={
                summary.bestAddedLoadKg != null ? exerciseUnit : undefined
              }
            />
          ) : (
            <>
              <MiniStat
                label={t("detail.bestWeight")}
                value={
                  summary.bestWeightKg != null
                    ? roundWeight(kgToUnit(summary.bestWeightKg, exerciseUnit))
                    : "—"
                }
                suffix={
                  summary.bestWeightKg != null ? exerciseUnit : undefined
                }
              />
              <MiniStat
                label={t("detail.est1rm")}
                value={
                  summary.estOneRepMaxKg != null
                    ? roundWeight(
                        kgToUnit(summary.estOneRepMaxKg, exerciseUnit),
                      )
                    : "—"
                }
                suffix={
                  summary.estOneRepMaxKg != null ? exerciseUnit : undefined
                }
              />
            </>
          )}
          <MiniStat label={t("detail.sessions")} value={summary.sessions} />
          <MiniStat label={t("detail.totalSets")} value={summary.totalSets} />
          <MiniStat label={t("stats.totalReps")} value={summary.totalReps} />
          {!isBodyweight && summary.totalVolumeKg != null && (
            <MiniStat
              label={t("stats.volume")}
              value={formatThousands(
                Math.round(kgToUnit(summary.totalVolumeKg, exerciseUnit)),
              )}
              suffix={exerciseUnit}
            />
          )}
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
            <p className={styles.repsLabel}>
              {isBodyweight
                ? t("detail.repsByAddedLoad")
                : t("detail.repsByWeight")}
            </p>
            <RepsByWeightTable
              stats={repStats}
              unit={exerciseUnit}
              maxRows={6}
              loadLabel={
                isBodyweight ? t("stats.addedLoad") : undefined
              }
              signedLoad={isBodyweight}
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
    <div className={styles.miniStat}>
      <p className={styles.miniStatLabel}>{label}</p>
      <DotValue value={value} suffix={suffix} className={styles.miniStatValue} />
    </div>
  );
}

/** 12345 → "12 345" (narrow no-break spaces). */
function formatThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatSignedWeight(valueKg: number | null, unit: Unit) {
  if (valueKg == null) return "—";
  const value = roundWeight(kgToUnit(valueKg, unit));
  return formatSignedValue(value);
}

function formatSignedValue(value: number) {
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized >= 0 ? `+${normalized}` : normalized;
}
