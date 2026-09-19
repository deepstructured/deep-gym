"use client";

import {
  addDays,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useMemo } from "react";
import { normalizeTrainingSchedule } from "@/entities/user";
import type { Workout } from "@/entities/workout";
import {
  ConsistencyHeatmap,
  WeeklyActivity,
  formatCompact,
  percentChange,
  periodTotals,
  weekStreak,
  weeklyBuckets,
  workoutsBetween,
} from "@/features/training-analytics";
import { ElapsedSince, useActiveWorkoutDraft } from "@/features/workout-form";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { getDateLocale, toISODate } from "@/shared/lib/dates";
import { kgToUnit } from "@/shared/lib/weight";
import {
  DotValue,
  IconChevronRight,
  IconDumbbell,
  IconFlame,
  IconHistory,
  IconPlus,
  IconTarget,
} from "@/shared/ui";
import { useHomeData, type TileProps } from "../home-data";
import { Tile, TileHead } from "./tile";
import styles from "./tiles.module.scss";

const MONDAY = new Date(2024, 0, 1);

/** Monday-based current week: which days have a workout. */
function useThisWeek(workouts: Workout[]) {
  return useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const from = toISODate(monday);
    const dates = new Set(
      workouts.filter((w) => w.date >= from).map((w) => w.date),
    );
    return {
      count: workouts.filter((w) => w.date >= from).length,
      days: Array.from({ length: 7 }, (_, index) =>
        dates.has(toISODate(addDays(monday, index))),
      ),
      today: (new Date().getDay() + 6) % 7,
    };
  }, [workouts]);
}

/** ▲ 12% style change; hidden without a baseline to compare with. */
function signedPercent(current: number, previous: number) {
  if (previous === 0) return null;
  const value = percentChange(current, previous);
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return {
    text: `${rounded > 0 ? "▲" : rounded < 0 ? "▼" : "•"} ${Math.abs(rounded)}%`,
    tone: rounded > 0 ? styles.up : rounded < 0 ? styles.down : undefined,
  };
}

export function StartTile({ size, wide }: TileProps) {
  const { t, tn } = useI18n();
  const { workoutCount } = useHomeData();
  const draft = useActiveWorkoutDraft();
  const small = size === "s" && !wide;

  if (draft) {
    return (
      <Tile
        href="/workouts/new"
        className={styles.live}
        ariaLabel={t("draft.continue")}
      >
        <span className={styles.liveBadge}>
          <span className={styles.liveDot} />
          {t("draft.inProgress")}
          {draft.startedAt && (
            <>
              {" · "}
              <ElapsedSince since={draft.startedAt} />
            </>
          )}
        </span>
        {small ? (
          <div className={styles.bottom}>
            <p className={styles.liveType}>{draft.type}</p>
            <p className={styles.meta}>
              {tn("count.exercises", draft.exercises)}
            </p>
          </div>
        ) : (
          <div className={cn(styles.row, styles.bottom)}>
            <div className={styles.grow}>
              <p className={styles.liveType}>{draft.type}</p>
              <p className={styles.meta}>
                {tn("count.exercises", draft.exercises)} ·{" "}
                {tn("count.sets", draft.filledSets)}
              </p>
            </div>
            <span className={styles.liveContinue}>
              {t("draft.continueShort")}
              <IconChevronRight size={16} />
            </span>
          </div>
        )}
      </Tile>
    );
  }

  return (
    <Tile
      href={workoutCount === 0 ? "/workouts/new?first=1" : "/workouts/new"}
      variant="pink"
    >
      <div className={cn(styles.startDots, "dots-bg")} />
      {small ? (
        <div className={styles.startSmall}>
          <span className={styles.startPlus}>
            <IconPlus size={24} />
          </span>
          <p className={styles.startTitle}>{t("home.startWorkout")}</p>
        </div>
      ) : (
        <div className={cn(styles.row, styles.centered)}>
          <div className={styles.grow}>
            <p className={styles.startTitle}>{t("home.startWorkout")}</p>
            <p className={styles.startSub}>{t("home.logSession")}</p>
          </div>
          <span className={styles.startPlus}>
            <IconPlus size={24} />
          </span>
        </div>
      )}
    </Tile>
  );
}

export function WeekTile({ size, wide }: TileProps) {
  const { t } = useI18n();
  const { workouts, profile } = useHomeData();
  const week = useThisWeek(workouts);
  const schedule = normalizeTrainingSchedule(profile?.training_schedule);
  const planned = schedule.filter(Boolean).length;
  const expanded = size === "m" || wide;

  return (
    <Tile href="/history">
      <TileHead
        label={t("home.workoutsThisWeek")}
        icon={<IconDumbbell size={15} />}
        tone="lime"
      />
      <DotValue
        value={week.count}
        suffix={expanded && planned > 0 ? `/${planned}` : undefined}
        className={cn(styles.valueBlock, styles.valueXl, styles.valueLime)}
        suffixClassName={styles.suffix}
      />
      <div aria-hidden="true" className={styles.weekBars}>
        {week.days.map((hasWorkout, index) => (
          <span key={index} className={styles.weekDay}>
            <span
              className={cn(
                styles.weekBar,
                expanded && styles.weekBarWide,
                hasWorkout && styles.weekBarActive,
                !hasWorkout && index === week.today && styles.weekBarToday,
                !hasWorkout &&
                  index > week.today &&
                  schedule[index] &&
                  styles.weekBarPlanned,
              )}
            />
            {expanded && (
              <span
                className={cn(
                  styles.weekLetter,
                  index === week.today && styles.weekLetterToday,
                )}
              >
                {format(addDays(MONDAY, index), "EEEEEE", {
                  locale: getDateLocale(),
                })}
              </span>
            )}
          </span>
        ))}
      </div>
    </Tile>
  );
}

export function StreakTile() {
  const { t } = useI18n();
  const { workouts } = useHomeData();
  const streak = useMemo(
    () => weekStreak(workouts.map((workout) => workout.date)),
    [workouts],
  );
  return (
    <Tile href="/history" variant="indigo">
      <TileHead
        label={t("home.weekStreak")}
        icon={<IconFlame size={14} />}
        tone="flame"
        onGradient
      />
      <DotValue
        value={streak}
        suffix={t("home.wk")}
        className={styles.value}
        suffixClassName={styles.suffix}
      />
    </Tile>
  );
}

export function TotalTile() {
  const { t } = useI18n();
  const { workouts, workoutCount } = useHomeData();
  const monthFrom = toISODate(startOfMonth(new Date()));
  const thisMonth = workouts.filter((w) => w.date >= monthFrom).length;
  return (
    <Tile href="/history">
      <TileHead
        label={t("home.totalWorkouts")}
        icon={<IconHistory size={14} />}
      />
      <DotValue value={workoutCount ?? 0} className={styles.value} />
      {thisMonth > 0 && (
        <p className={styles.metaFaint}>
          {t("widget.totalWorkouts.thisMonth", { n: thisMonth })}
        </p>
      )}
    </Tile>
  );
}

function GoalRing({
  done,
  target,
  size,
}: {
  done: number;
  target: number;
  size: number;
}) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(done / target, 1);
  return (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        {progress > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-lime)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * progress} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dasharray 500ms ease" }}
          />
        )}
      </svg>
      <span className={styles.ringText}>
        {done}
        <small>/{target}</small>
      </span>
    </div>
  );
}

export function GoalTile({ size, wide }: TileProps) {
  const { t, tn } = useI18n();
  const { workouts, profile } = useHomeData();
  const week = useThisWeek(workouts);
  const planned = normalizeTrainingSchedule(profile?.training_schedule).filter(
    Boolean,
  ).length;
  const target = planned || 3;
  const remaining = Math.max(target - week.count, 0);
  const expanded = size === "m" || wide;

  return (
    <Tile href="/history">
      <TileHead
        label={t("widget.weeklyGoal.title")}
        icon={<IconTarget size={15} />}
        tone="lime"
      />
      {expanded ? (
        <div className={cn(styles.row, styles.centered)}>
          <GoalRing done={week.count} target={target} size={84} />
          <div className={styles.grow}>
            <p className={styles.listTitle}>
              {t("widget.weeklyGoal.progress", {
                done: week.count,
                target,
              })}
            </p>
            <p className={styles.meta}>
              {remaining > 0
                ? tn("widget.weeklyGoal.remaining", remaining)
                : t("widget.weeklyGoal.reached")}
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.ringCenter}>
          <GoalRing done={week.count} target={target} size={76} />
        </div>
      )}
    </Tile>
  );
}

export function ConsistencyTile({ size }: TileProps) {
  const { t, tn } = useI18n();
  const { workouts } = useHomeData();
  const weeks = size === "l" ? 26 : 20;
  const stats = useMemo(() => {
    const buckets = weeklyBuckets(workouts, weeks);
    const active = buckets.filter((bucket) => bucket.workouts > 0).length;
    return {
      workouts: buckets.reduce((sum, bucket) => sum + bucket.workouts, 0),
      activeShare: Math.round((active / weeks) * 100),
      streak: weekStreak(workouts.map((workout) => workout.date)),
    };
  }, [workouts, weeks]);

  return (
    <Tile href="/progress">
      <TileHead
        label={t("widget.consistency.title")}
        action={
          <span className={styles.metaFaint}>
            {tn("widget.consistency.weeks", weeks)}
          </span>
        }
      />
      <div className={styles.chartSlot}>
        <ConsistencyHeatmap workouts={workouts} weeks={weeks} />
      </div>
      {size === "l" && (
        <div className={cn(styles.trio, styles.trioSpaced)}>
          <Stat label={t("progress.workouts")} value={stats.workouts} />
          <Stat
            label={t("widget.consistency.activeWeeks")}
            value={`${stats.activeShare}%`}
          />
          <Stat
            label={t("home.weekStreak")}
            value={stats.streak}
            suffix={t("home.wk")}
          />
        </div>
      )}
    </Tile>
  );
}

function Stat({
  label,
  value,
  suffix,
  delta,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  delta?: { text: string; tone?: string } | null;
}) {
  return (
    <div className={styles.trioCell}>
      <p className={styles.label}>{label}</p>
      <DotValue
        value={value}
        suffix={suffix}
        className={styles.trioValue}
        suffixClassName={styles.suffix}
      />
      {delta && <p className={cn(styles.delta, delta.tone)}>{delta.text}</p>}
    </div>
  );
}

export function WeeklyVolumeTile({ size, wide }: TileProps) {
  const { t } = useI18n();
  const { workouts, unit } = useHomeData();
  const [previous, current] = useMemo(
    () => weeklyBuckets(workouts, 2),
    [workouts],
  );
  const delta = signedPercent(current.volumeKg, previous.volumeKg);
  const expanded = size === "m" || wide;

  return (
    <Tile href="/progress">
      <TileHead label={t("widget.weeklyVolume.title")} />
      <div className={cn(styles.bottom, expanded && styles.row)}>
        <div>
          <DotValue
            value={formatCompact(kgToUnit(current.volumeKg, unit))}
            suffix={unit}
            className={styles.trioValue}
            suffixClassName={styles.suffix}
          />
          {delta && (
            <p className={cn(styles.delta, delta.tone)}>
              {delta.text}{" "}
              <span className={styles.metaFaint}>
                {t("widget.weeklyVolume.vsLast")}
              </span>
            </p>
          )}
        </div>
        {expanded && (
          <div className={styles.grow}>
            <WeeklyActivity
              workouts={workouts}
              unit={unit}
              weeks={8}
              height={78}
              metric="volume"
            />
          </div>
        )}
      </div>
    </Tile>
  );
}

export function MonthTile() {
  const { t } = useI18n();
  const { workouts, unit } = useHomeData();
  const { current, previous, label } = useMemo(() => {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const monthStart = startOfMonth(now);
    const prevStart = startOfMonth(subMonths(now, 1));
    // Compare with the same number of days of last month.
    const prevEnd = addDays(prevStart, dayOfMonth - 1);
    return {
      current: periodTotals(
        workoutsBetween(workouts, toISODate(monthStart)),
        dayOfMonth,
      ),
      previous: periodTotals(
        workoutsBetween(workouts, toISODate(prevStart), toISODate(prevEnd)),
        dayOfMonth,
      ),
      label: format(now, "LLLL", { locale: getDateLocale() }),
    };
  }, [workouts]);

  return (
    <Tile href="/progress">
      <TileHead
        label={t("widget.monthSummary.title", { month: label })}
        action={
          <span className={styles.metaFaint}>
            {t("widget.monthSummary.vs")}
          </span>
        }
      />
      <div className={styles.trio}>
        <Stat
          label={t("progress.workouts")}
          value={current.workouts}
          delta={signedPercent(current.workouts, previous.workouts)}
        />
        <Stat
          label={t("progress.sets")}
          value={current.sets}
          delta={signedPercent(current.sets, previous.sets)}
        />
        <Stat
          label={t("stats.volume")}
          value={formatCompact(kgToUnit(current.volumeKg, unit))}
          suffix={unit}
          delta={signedPercent(current.volumeKg, previous.volumeKg)}
        />
      </div>
    </Tile>
  );
}
