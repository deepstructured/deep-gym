"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useBodyWeightMeasurements } from "@/entities/body-weight";
import { useExercises } from "@/entities/exercise";
import { useMuscleGroups } from "@/entities/muscle-group";
import { useExerciseHistory } from "@/entities/workout";
import { BodyWeightChart } from "@/features/body-weight";
import {
  BODYWEIGHT_METRICS,
  EXTERNAL_METRICS,
  ExerciseProgressPanel,
  formatMetricDelta,
  formatMetricValue,
  metricSeries,
  type ProgressMetric,
} from "@/features/exercise-stats";
import {
  MuscleBalance,
  RecordsList,
  bestLifts,
  personalRecords,
  workoutsBetween,
} from "@/features/training-analytics";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { periodStart } from "@/shared/lib/period";
import { formatDay } from "@/shared/lib/dates";
import { kgToUnit, roundWeight } from "@/shared/lib/weight";
import {
  DotValue,
  IconChevronDown,
  IconChevronRight,
  IconScale,
  IconTrophy,
  LineChart,
  Sheet,
} from "@/shared/ui";
import { useHomeData, type TileProps } from "../home-data";
import { Tile, TileHead } from "./tile";
import styles from "./tiles.module.scss";

/** Exercises with logged working sets, most recently trained first. */
function useRecentExerciseIds() {
  const { workouts } = useHomeData();
  return useMemo(() => {
    const ids: string[] = [];
    for (const workout of workouts) {
      for (const we of workout.workout_exercises) {
        if (!ids.includes(we.exercise_id) && we.sets.length > 0) {
          ids.push(we.exercise_id);
        }
      }
    }
    return ids;
  }, [workouts]);
}

export function ExerciseProgressTile({
  widget,
  size,
  onConfigChange,
}: TileProps) {
  const { t } = useI18n();
  const { unit } = useHomeData();
  const { data: exercises } = useExercises();
  const { data: groups } = useMuscleGroups();
  const recentIds = useRecentExerciseIds();
  const [pickerOpen, setPickerOpen] = useState(false);

  const pinnedId = widget.config?.exerciseId;
  const exerciseId =
    pinnedId && exercises?.some((exercise) => exercise.id === pinnedId)
      ? pinnedId
      : recentIds[0];
  const exercise = exercises?.find((item) => item.id === exerciseId);
  const { data: history } = useExerciseHistory(exerciseId ?? "");
  const exerciseUnit = exercise?.unit ?? unit;
  const bodyweight = exercise?.equipment === "bodyweight";
  // A stored metric may not fit after the exercise changed its load mode.
  const allowed = bodyweight ? BODYWEIGHT_METRICS : EXTERNAL_METRICS;
  const stored = widget.config?.metric as ProgressMetric | undefined;
  const metric = stored && allowed.includes(stored) ? stored : allowed[0];
  const groupName =
    groups?.find((group) => group.id === exercise?.muscle_group_id)?.name ??
    "";

  const header = (
    <div className={styles.head}>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className={styles.exerciseButton}
        disabled={!exercise}
      >
        <span>{exercise?.name ?? t("home.progress")}</span>
        <IconChevronDown size={15} />
      </button>
      {exercise && (
        <Link href={`/exercises/${exercise.id}`} className={styles.headLink}>
          {t("home.details")}
          <IconChevronRight size={14} />
        </Link>
      )}
    </div>
  );

  const picker = (
    <Sheet
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      title={t("widget.exerciseProgress.pick")}
    >
      <div className={styles.pickerList}>
        <button
          type="button"
          onClick={() => {
            onConfigChange({ ...widget.config, exerciseId: undefined });
            setPickerOpen(false);
          }}
          className={cn(
            styles.pickerItem,
            !pinnedId && styles.pickerItemActive,
          )}
        >
          <span>
            {t("widget.exerciseProgress.auto")}
            <small>{t("widget.exerciseProgress.autoHint")}</small>
          </span>
        </button>
        {recentIds.map((id) => {
          const item = exercises?.find((candidate) => candidate.id === id);
          if (!item) return null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                onConfigChange({ ...widget.config, exerciseId: id });
                setPickerOpen(false);
              }}
              className={cn(
                styles.pickerItem,
                pinnedId === id && styles.pickerItemActive,
              )}
            >
              <span>
                {item.name}
                <small>
                  {groups?.find((g) => g.id === item.muscle_group_id)?.name}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );

  if (!exercise) {
    return (
      <Tile>
        <TileHead label={t("home.progress")} />
        <p className={styles.empty}>{t("widget.exerciseProgress.empty")}</p>
      </Tile>
    );
  }

  if (size === "m") {
    return (
      <Tile>
        {header}
        <CompactProgress
          records={history}
          metric={metric}
          unit={exerciseUnit}
        />
        {picker}
      </Tile>
    );
  }

  return (
    <Tile className={styles.progressTile}>
      {header}
      <ExerciseProgressPanel
        key={exercise.id}
        records={history}
        unit={exerciseUnit}
        bodyweight={bodyweight}
        exerciseName={exercise.name}
        subtitle={groupName}
        metric={metric}
        onMetricChange={(next) =>
          onConfigChange({ ...widget.config, metric: next })
        }
        compact
      />
      {picker}
    </Tile>
  );
}

/** Latest value, change over the last three months and a sparkline. */
function CompactProgress({
  records,
  metric,
  unit,
}: {
  records: ReturnType<typeof useExerciseHistory>["data"];
  metric: ProgressMetric;
  unit: "kg" | "lb";
}) {
  const { t } = useI18n();
  const points = useMemo(() => {
    const from = periodStart("3m");
    return metricSeries(records ?? [], metric)
      .filter((point) => !from || point.date >= from)
      .map((point) => ({
        date: point.date,
        value:
          metric === "reps" ? point.valueKg : kgToUnit(point.valueKg, unit),
      }));
  }, [records, metric, unit]);
  const last = points.at(-1);
  const first = points[0];

  if (!last) {
    return <p className={styles.empty}>{t("stats.emptyPeriod")}</p>;
  }
  return (
    <div className={cn(styles.row, styles.bottom)}>
      <div>
        <p className={styles.label}>{t(`stats.metric.${metric}`)}</p>
        <DotValue
          value={formatMetricValue(last.value, metric)}
          suffix={metric === "reps" ? undefined : unit}
          className={styles.trioValue}
          suffixClassName={styles.suffix}
        />
        {points.length > 1 && (
          <p
            className={cn(
              styles.delta,
              last.value > first.value && styles.up,
              last.value < first.value && styles.down,
            )}
          >
            {formatMetricDelta(last.value - first.value, metric)}{" "}
            <span className={styles.metaFaint}>{t("period.over.3m")}</span>
          </p>
        )}
      </div>
      <div className={styles.grow}>
        <LineChart
          points={points}
          height={64}
          axes={false}
          framed={false}
          interactive={false}
          showTooltip={false}
          showDots={false}
          formatValue={(value) => formatMetricValue(value, metric)}
        />
      </div>
    </div>
  );
}

export function RecordsTile({ size }: TileProps) {
  const { t } = useI18n();
  const { workouts, unit } = useHomeData();
  const records = useMemo(
    () => personalRecords(workouts, periodStart("3m")),
    [workouts],
  );
  return (
    <Tile>
      <TileHead
        label={t("progress.records")}
        icon={<IconTrophy size={14} />}
        tone="lime"
      />
      <div className={styles.listSlot}>
        <RecordsList
          records={records}
          unit={unit}
          limit={size === "l" ? 5 : 2}
          compact
          emptyLabel={t("progress.recordsEmpty")}
        />
      </div>
    </Tile>
  );
}

export function StrongestTile({ size }: TileProps) {
  const { t } = useI18n();
  const { workouts, unit } = useHomeData();
  const lifts = useMemo(
    () => bestLifts(workouts, size === "l" ? 5 : 3),
    [workouts, size],
  );
  return (
    <Tile href="/progress">
      <TileHead
        label={t("progress.strongest")}
        action={
          <span className={styles.metaFaint}>{t("stats.oneRmShort")}</span>
        }
      />
      {lifts.length === 0 ? (
        <p className={styles.empty}>{t("widget.exerciseProgress.empty")}</p>
      ) : (
        <div className={cn(styles.list, styles.listSlot)}>
          {lifts.map((lift) => {
            const liftUnit = lift.exerciseUnit ?? unit;
            return (
              <div key={lift.exerciseId} className={styles.listRow}>
                <span className={styles.listText}>
                  <span className={styles.listTitle}>{lift.exerciseName}</span>
                  {size === "l" && (
                    <span className={styles.listMeta}>
                      {roundWeight(kgToUnit(lift.weightKg, liftUnit))} ×{" "}
                      {lift.reps} · {formatDay(lift.date)}
                    </span>
                  )}
                </span>
                <span className={styles.listValue}>
                  {roundWeight(kgToUnit(lift.oneRmKg, liftUnit))}
                  <small> {liftUnit}</small>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Tile>
  );
}

export function MuscleTile({ size }: TileProps) {
  const { t } = useI18n();
  const { workouts } = useHomeData();
  const recent = useMemo(
    () => workoutsBetween(workouts, periodStart("1m")),
    [workouts],
  );
  return (
    <Tile href="/progress">
      <TileHead
        label={t("widget.muscleBalance.title")}
        action={<span className={styles.metaFaint}>{t("period.over.1m")}</span>}
      />
      <div className={styles.listSlot}>
        <MuscleBalance
          workouts={recent}
          limit={size === "l" ? 8 : 3}
          compact
          emptyLabel={t("progress.muscleEmpty")}
        />
      </div>
    </Tile>
  );
}

export function BodyWeightTile({ size, wide }: TileProps) {
  const { t } = useI18n();
  const { profile, unit, openWeightSheet } = useHomeData();
  const { data } = useBodyWeightMeasurements({ limit: 30 });
  const rows = data ?? [];
  const current = profile?.body_weight_kg ?? rows[0]?.weight_kg ?? null;
  const oldest = rows.at(-1);
  const change =
    current != null && oldest && rows.length > 1
      ? roundWeight(kgToUnit(current - oldest.weight_kg, unit))
      : null;
  const expanded = size === "m" || wide;

  return (
    <Tile onClick={openWeightSheet} ariaLabel={t("bodyWeight.record")}>
      <TileHead
        label={t("bodyWeight.title")}
        icon={<IconScale size={14} />}
        tone="lime"
      />
      {current == null ? (
        <p className={styles.empty}>{t("widget.bodyWeight.empty")}</p>
      ) : (
        <div className={cn(styles.bottom, expanded && styles.row)}>
          <div>
            <DotValue
              value={roundWeight(kgToUnit(current, unit))}
              suffix={unit}
              className={styles.trioValue}
              suffixClassName={styles.suffix}
            />
            {change != null && (
              <p className={styles.delta}>
                {change > 0 ? "+" : change < 0 ? "−" : ""}
                {Math.abs(change)} {unit}
              </p>
            )}
          </div>
          {rows.length > 1 && (
            <div className={expanded ? styles.grow : styles.sparkSmall}>
              <BodyWeightChart
                measurements={rows}
                unit={unit}
                height={expanded ? 64 : 36}
                sparkline
              />
            </div>
          )}
        </div>
      )}
    </Tile>
  );
}
