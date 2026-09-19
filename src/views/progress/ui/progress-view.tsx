"use client";

import { differenceInCalendarDays, differenceInCalendarWeeks } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMuscleGroups } from "@/entities/muscle-group";
import { useProfile } from "@/entities/user";
import { useAllWorkouts } from "@/entities/workout";
import { BodyWeightTracker, BodyWeightTrend } from "@/features/body-weight";
import { ProgressExplorer } from "@/features/exercise-stats";
import {
  MuscleBalance,
  PeriodOverview,
  RecordsList,
  WeeklyActivity,
  bestLifts,
  periodTotals,
  personalRecords,
  workoutsBetween,
  workoutsForGroup,
} from "@/features/training-analytics";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { fromISODate } from "@/shared/lib/dates";
import {
  periodStart,
  previousPeriodRange,
  usePreferredPeriod,
  type PeriodKey,
} from "@/shared/lib/period";
import { kgToUnit, roundWeight } from "@/shared/lib/weight";
import { AppShell } from "@/widgets/app-shell";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  IconPlus,
  PageLoader,
  PeriodSwitch,
  Sheet,
} from "@/shared/ui";
import styles from "./progress-view.module.scss";

function weeksFor(period: PeriodKey, firstDate: string | null): number {
  switch (period) {
    case "1m":
      return 5;
    case "3m":
      return 13;
    case "6m":
      return 26;
    case "1y":
      return 52;
    case "all":
      return firstDate
        ? Math.min(
            52,
            Math.max(
              4,
              differenceInCalendarWeeks(new Date(), fromISODate(firstDate), {
                weekStartsOn: 1,
              }) + 1,
            ),
          )
        : 12;
  }
}

export function ProgressView() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: profile } = useProfile();
  const unit = profile?.unit ?? "kg";
  const [period, setPeriod] = usePreferredPeriod();
  const [logWeightOpen, setLogWeightOpen] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const { data: groups } = useMuscleGroups();
  // Fetched once and sliced client-side, so switching the period is instant.
  const { data: workouts, isLoading } = useAllWorkouts();

  // Muscle groups that appear in the history, for the focus chips.
  const groupsWithData = useMemo(() => {
    const ids = new Set(
      (workouts ?? []).flatMap((workout) =>
        workout.workout_exercises.map((we) => we.exercise?.muscle_group_id),
      ),
    );
    return (groups ?? []).filter((group) => ids.has(group.id));
  }, [groups, workouts]);
  const focusedGroupId = groupsWithData.some((group) => group.id === groupId)
    ? groupId
    : null;

  const view = useMemo(() => {
    const all = workoutsForGroup(workouts ?? [], focusedGroupId);
    const from = periodStart(period);
    const previousRange = previousPeriodRange(period);
    const firstDate = all.at(-1)?.date ?? null;
    const spanDays = from
      ? differenceInCalendarDays(new Date(), fromISODate(from)) + 1
      : undefined;
    const current = workoutsBetween(all, from);
    return {
      current,
      totals: periodTotals(current, spanDays),
      previousTotals: previousRange
        ? periodTotals(
            workoutsBetween(all, previousRange.from, previousRange.to),
            spanDays,
          )
        : null,
      records: personalRecords(all, from),
      lifts: bestLifts(current, 5),
      weeks: weeksFor(period, firstDate),
    };
  }, [workouts, period, focusedGroupId]);

  return (
    <AppShell
      title={t("nav.progress")}
      account
      subheader={<PeriodSwitch value={period} onChange={setPeriod} />}
    >
      {isLoading ? (
        <PageLoader />
      ) : (workouts ?? []).length === 0 ? (
        <EmptyState
          title={t("progress.emptyTitle")}
          hint={t("progress.emptyHint")}
          action={
            <Button variant="lime" onClick={() => router.push("/workouts/new")}>
              <IconPlus size={17} />
              {t("home.startWorkout")}
            </Button>
          }
        />
      ) : (
        <div className={styles.stack}>
          {groupsWithData.length > 1 && (
            <div
              role="group"
              aria-label={t("progress.focus")}
              className={cn(styles.focus, "no-scrollbar")}
            >
              <Chip
                selected={focusedGroupId == null}
                className={styles.focusChip}
                onClick={() => setGroupId(null)}
              >
                {t("progress.allGroups")}
              </Chip>
              {groupsWithData.map((group) => (
                <Chip
                  key={group.id}
                  selected={group.id === focusedGroupId}
                  className={styles.focusChip}
                  onClick={() =>
                    setGroupId(group.id === focusedGroupId ? null : group.id)
                  }
                >
                  {group.name}
                </Chip>
              ))}
            </div>
          )}

          <PeriodOverview
            current={view.totals}
            previous={view.previousTotals}
            unit={unit}
          />

          <Section title={t("progress.activity")}>
            <Card variant="surface" className={styles.card}>
              <WeeklyActivity
                workouts={view.current}
                unit={unit}
                weeks={view.weeks}
              />
            </Card>
          </Section>

          <Section title={t("progress.exercises")}>
            <ProgressExplorer
              workouts={workouts}
              unit={unit}
              period={period}
              onPeriodChange={setPeriod}
              groupId={focusedGroupId}
            />
          </Section>

          <Section title={t("progress.records")}>
            <Card variant="surface" className={styles.card}>
              <RecordsList
                records={view.records}
                unit={unit}
                limit={6}
                emptyLabel={t("progress.recordsEmpty")}
              />
            </Card>
          </Section>

          {view.lifts.length > 0 && (
            <Section title={t("progress.strongest")}>
              <Card variant="surface" className={styles.card}>
                <div className={styles.lifts}>
                  {view.lifts.map((lift, index) => {
                    const liftUnit = lift.exerciseUnit ?? unit;
                    return (
                      <Link
                        key={lift.exerciseId}
                        href={`/exercises/${lift.exerciseId}`}
                        className={styles.lift}
                      >
                        <span className={styles.liftRank}>{index + 1}</span>
                        <span className={styles.liftText}>
                          <span className={styles.liftName}>
                            {lift.exerciseName}
                          </span>
                          <span className={styles.liftMeta}>
                            {roundWeight(kgToUnit(lift.weightKg, liftUnit))}{" "}
                            {liftUnit} × {lift.reps}
                          </span>
                        </span>
                        <span className={styles.liftValue}>
                          {roundWeight(kgToUnit(lift.oneRmKg, liftUnit))}
                          <em>
                            {t("stats.metric.oneRm")}, {liftUnit}
                          </em>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            </Section>
          )}

          {/* Comparing groups makes no sense while focused on one. */}
          {focusedGroupId == null && (
            <Section title={t("progress.muscleGroups")}>
              <Card variant="surface" className={styles.card}>
                <MuscleBalance
                  workouts={view.current}
                  emptyLabel={t("progress.muscleEmpty")}
                />
              </Card>
            </Section>
          )}

          <Section
            title={t("bodyWeight.title")}
            action={
              <button
                type="button"
                onClick={() => setLogWeightOpen(true)}
                className={styles.sectionAction}
              >
                <IconPlus size={14} />
                {t("bodyWeight.record")}
              </button>
            }
          >
            <Card variant="surface" className={styles.card}>
              <BodyWeightTrend
                period={period}
                emptyLabel={t("bodyWeight.historyEmptyHint")}
              />
            </Card>
          </Section>
        </div>
      )}

      <Sheet
        open={logWeightOpen}
        onClose={() => setLogWeightOpen(false)}
        title={t("bodyWeight.title")}
      >
        <BodyWeightTracker
          bare
          allowTimestampEdit
          onLogged={() => setLogWeightOpen(false)}
        />
      </Sheet>
    </AppShell>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
