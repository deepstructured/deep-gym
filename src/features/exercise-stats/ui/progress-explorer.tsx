"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useExercises, type Exercise } from "@/entities/exercise";
import { useMuscleGroups } from "@/entities/muscle-group";
import type { ExerciseSetRecord, Workout } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { periodStart, type PeriodKey } from "@/shared/lib/period";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";
import { Card, Chip, DotValue, IconChevronRight } from "@/shared/ui";
import { formatSigned, formatThousands } from "../model/format";
import {
  extendedSummary,
  filterByLoad,
  repStatsByWeight,
} from "../model/stats";
import { ExerciseProgressPanel } from "./exercise-progress";
import { useLoadFilterState } from "./load-filter";
import { RepsByWeightTable } from "./reps-by-weight-table";
import styles from "./progress-explorer.module.scss";

/** Every set per exercise (warm-ups included, the stats skip them), oldest
 *  first — the shape `useExerciseHistory` returns, built from workouts the
 *  page already loaded. */
export function recordsByExercise(
  workouts: Workout[] | undefined,
): Map<string, ExerciseSetRecord[]> {
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
          set_type: set.set_type === "warmup" ? "warmup" : "working",
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
        a.workoutDate.localeCompare(b.workoutDate) || a.position - b.position,
    );
  }
  return map;
}

interface ProgressExplorerProps {
  workouts: Workout[] | undefined;
  /** Profile default unit; per-exercise overrides still win. */
  unit: Unit;
  /** Page-level period that drives the chart and the tiles. */
  period: PeriodKey;
  onPeriodChange: (period: PeriodKey) => void;
  /** Page-level muscle-group focus; hides the group chips. */
  groupId?: string | null;
}

/**
 * Pick a muscle group and an exercise — get the interactive metric chart,
 * period tiles and the reps-by-weight breakdown. Hidden until some exercise
 * has at least one logged set.
 */
export function ProgressExplorer({
  workouts,
  unit,
  period,
  onPeriodChange,
  groupId = null,
}: ProgressExplorerProps) {
  const { data: exercises } = useExercises();
  const { data: groups } = useMuscleGroups();

  const [groupChoice, setGroupChoice] = useState<string | null>(null);
  const [exerciseChoice, setExerciseChoice] = useState<string | null>(null);

  const byExercise = useMemo(() => recordsByExercise(workouts), [workouts]);

  // Exercises with at least one working set, most recently trained first.
  const chartable = useMemo(() => {
    const lastDates = new Map<string, string>();
    for (const [exerciseId, records] of byExercise) {
      const dates = records
        .filter(
          (r) =>
            r.set_type !== "warmup" && (r.weight_kg != null || r.reps != null),
        )
        .map((r) => r.workoutDate);
      if (dates.length === 0) continue;
      lastDates.set(exerciseId, dates.sort().at(-1)!);
    }
    return (exercises ?? [])
      .filter((exercise) => lastDates.has(exercise.id))
      .sort((a, b) => lastDates.get(b.id)!.localeCompare(lastDates.get(a.id)!));
  }, [exercises, byExercise]);

  if (chartable.length === 0) return null;

  const groupsWithData = (groups ?? []).filter((group) =>
    chartable.some((exercise) => exercise.muscle_group_id === group.id),
  );

  // Defaults follow the most recently trained exercise.
  const activeGroupId =
    groupId != null && groupsWithData.some((g) => g.id === groupId)
      ? groupId
      : groupChoice != null &&
          groupsWithData.some((g) => g.id === groupChoice)
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

  const groupName =
    groups?.find((group) => group.id === activeExercise.muscle_group_id)
      ?.name ?? "";

  return (
    <Card variant="surface" className={styles.card}>
      {groupId == null && (
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
      )}

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

      {/* Keyed: a specific-load filter belongs to one exercise. */}
      <ExerciseInsights
        key={activeExercise.id}
        exercise={activeExercise}
        groupName={groupName}
        records={byExercise.get(activeExercise.id) ?? []}
        unit={unit}
        period={period}
        onPeriodChange={onPeriodChange}
      />
    </Card>
  );
}

/** Chart, period tiles and reps table of one exercise — all counting the
 *  same sets under the chosen load filter. */
function ExerciseInsights({
  exercise,
  groupName,
  records,
  unit,
  period,
  onPeriodChange,
}: {
  exercise: Exercise;
  groupName: string;
  records: ExerciseSetRecord[];
  unit: Unit;
  period: PeriodKey;
  onPeriodChange: (period: PeriodKey) => void;
}) {
  const { t } = useI18n();
  const exerciseUnit = exercise.unit ?? unit;
  const isBodyweight = exercise.equipment === "bodyweight";
  const loadMode = isBodyweight ? "bodyweight" : "external";
  const [filter, setFilter] = useLoadFilterState(isBodyweight);

  // Filter the full history first: the working-weight reference looks
  // back across sessions that may predate the period.
  const from = periodStart(period);
  const periodRecords = filterByLoad(records, filter).filter(
    (record) => !from || record.workoutDate >= from,
  );
  const summary = extendedSummary(periodRecords, { loadMode });
  const repStats = repStatsByWeight(periodRecords, { loadMode });

  return (
    <>
      <ExerciseProgressPanel
        records={records}
        unit={exerciseUnit}
        bodyweight={isBodyweight}
        exerciseName={exercise.name}
        subtitle={groupName}
        period={period}
        onPeriodChange={onPeriodChange}
        showPeriodSwitch={false}
        loadFilter={filter}
        onLoadFilterChange={setFilter}
      />

      {/* Period tiles */}
      <div className={styles.statGrid}>
        {isBodyweight ? (
          <MiniStat
            label={t("detail.bestAddedLoad")}
            value={
              summary.bestAddedLoadKg != null
                ? formatSigned(
                    roundWeight(kgToUnit(summary.bestAddedLoadKg, exerciseUnit)),
                  )
                : "—"
            }
            suffix={summary.bestAddedLoadKg != null ? exerciseUnit : undefined}
          />
        ) : (
          <MiniStat
            label={t("detail.est1rm")}
            value={
              summary.estOneRepMaxKg != null
                ? roundWeight(kgToUnit(summary.estOneRepMaxKg, exerciseUnit))
                : "—"
            }
            suffix={summary.estOneRepMaxKg != null ? exerciseUnit : undefined}
          />
        )}
        <MiniStat label={t("detail.totalSets")} value={summary.totalSets} />
        <MiniStat label={t("stats.totalReps")} value={summary.totalReps} />
        {!isBodyweight && summary.totalVolumeKg != null ? (
          <MiniStat
            label={t("stats.volume")}
            value={formatThousands(
              Math.round(kgToUnit(summary.totalVolumeKg, exerciseUnit)),
            )}
            suffix={exerciseUnit}
          />
        ) : (
          <MiniStat label={t("detail.sessions")} value={summary.sessions} />
        )}
        <MiniStat
          label={t("stats.failRate")}
          value={`${Math.round(summary.failureRate * 100)}%`}
        />
        <MiniStat
          label={t("stats.perWeekShort")}
          value={summary.perWeek ?? "—"}
          suffix={summary.perWeek != null ? "×" : undefined}
        />
      </div>

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
            loadLabel={isBodyweight ? t("stats.addedLoad") : undefined}
            signedLoad={isBodyweight}
          />
        </div>
      )}

      <Link href={`/exercises/${exercise.id}`} className={styles.detailsLink}>
        {t("progress.openExercise", { name: exercise.name })}
        <IconChevronRight size={15} />
      </Link>
    </>
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
