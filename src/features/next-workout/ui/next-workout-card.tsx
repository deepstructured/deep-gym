"use client";

import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import Link from "next/link";
import { useMemo } from "react";
import type { TrainingSchedule } from "@/entities/user";
import { useI18n } from "@/shared/i18n";
import { fromISODate, getDateLocale } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { Card, DotValue, IconCalendar, IconChevronRight } from "@/shared/ui";
import {
  nextScheduledWorkout,
  type ScheduledWorkout,
} from "../model/predict";
import styles from "./next-workout-card.module.scss";

interface ScheduledWorkoutCardProps {
  prediction: ScheduledWorkout;
  /** Small uppercase label; defaults to "Next workout". */
  label?: string;
}

/** "Today / Tomorrow / Thursday · Lower" — taps through to a new workout
 *  with the predicted type preselected. */
export function ScheduledWorkoutCard({
  prediction,
  label,
}: ScheduledWorkoutCardProps) {
  const { t, lang } = useI18n();

  const isToday = prediction.daysAway === 0;
  const workoutDate = fromISODate(prediction.date);
  const weekStart = startOfWeek(workoutDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  // lang is read so the weekday re-renders on language switch
  void lang;
  const when = isToday
    ? t("home.today")
    : prediction.daysAway === 1
      ? t("home.tomorrow")
      : capitalize(
          format(fromISODate(prediction.date), "EEEE", {
            locale: getDateLocale(),
          }),
        );

  return (
    <Link
      href={`/workouts/new?type=${encodeURIComponent(prediction.type)}&date=${prediction.date}`}
      className={styles.link}
    >
      <Card variant="cherry" className={styles.card}>
        <div className={cn(styles.dots, "dots-bg")} />

        <div className={styles.inner}>
          <div className={styles.topRow}>
            <span className={styles.calendarBadge}>
              <IconCalendar size={17} />
            </span>
            <span className={styles.topText}>
              <span className={styles.label}>
                {label ?? t("home.nextWorkout")}
              </span>
              <span className={cn(styles.when, isToday && styles.whenToday)}>
                {when}
              </span>
            </span>
            <span className={styles.arrow}>
              <IconChevronRight size={18} />
            </span>
          </div>

          <div className={styles.dateRow}>
            <span className={styles.dateGroup}>
              <DotValue
                value={format(workoutDate, "d")}
                className={styles.dayNumber}
              />
              <span className={styles.monthLabel}>
                {format(workoutDate, "MMM", { locale: getDateLocale() })}
              </span>
            </span>
            <span className={styles.typeGroup}>
              <span className={styles.weekdayLabel}>
                {format(workoutDate, "EEEE", {
                  locale: getDateLocale(),
                })}
              </span>
              <span className={styles.typeName}>
                {prediction.type}
              </span>
            </span>
          </div>

          <div className={styles.weekRow}>
            {weekDays.map((day) => {
              const active = isSameDay(day, workoutDate);
              return (
                <span key={day.toISOString()} className={styles.weekDay}>
                  <span
                    className={cn(
                      styles.weekDayLetter,
                      active && styles.weekDayLetterActive,
                    )}
                  >
                    {format(day, "EEEEE", { locale: getDateLocale() })}
                  </span>
                  <span
                    className={cn(styles.weekDot, active && styles.weekDotActive)}
                  />
                </span>
              );
            })}
          </div>
        </div>
      </Card>
    </Link>
  );
}

interface NextWorkoutCardProps {
  schedule: TrainingSchedule | null | undefined;
  workouts: { date: string; type: string }[] | undefined;
}

/** The home-screen widget — hidden until the user configures training days. */
export function NextWorkoutCard({
  schedule,
  workouts,
}: NextWorkoutCardProps) {
  const prediction = useMemo(
    () => (workouts ? nextScheduledWorkout(schedule, workouts) : null),
    [schedule, workouts],
  );
  if (!prediction) return null;
  return <ScheduledWorkoutCard prediction={prediction} />;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
