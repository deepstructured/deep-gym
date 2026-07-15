"use client";

import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import Link from "next/link";
import { useMemo } from "react";
import type { TrainingSchedule } from "@/entities/user";
import { useI18n } from "@/shared/i18n";
import { fromISODate, getDateLocale } from "@/shared/lib/dates";
import { Card, DotValue, IconCalendar, IconChevronRight } from "@/shared/ui";
import {
  nextScheduledWorkout,
  type ScheduledWorkout,
} from "../model/predict";

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
      className="group block rounded-card"
    >
      <Card
        variant="cherry"
        className="min-h-44 p-5 transition-[filter,transform] duration-200 group-active:scale-[0.99] group-active:brightness-95"
      >
        <div className="dots-bg pointer-events-none absolute inset-0 opacity-[0.08]" />

        <div className="relative">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 ring-1 ring-white/10">
              <IconCalendar size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold tracking-[0.14em] text-white/55 uppercase">
                {label ?? t("home.nextWorkout")}
              </span>
              <span
                className={
                  isToday
                    ? "mt-0.5 block text-sm font-medium text-lime"
                    : "mt-0.5 block text-sm font-medium text-white/[0.78]"
                }
              >
                {when}
              </span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#170c0b] shadow-[0_8px_24px_-12px_rgba(255,255,255,0.8)]">
              <IconChevronRight size={18} />
            </span>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <span className="flex items-end gap-2">
              <DotValue
                value={format(workoutDate, "d")}
                className="text-[46px] text-white"
              />
              <span className="pb-1.5 text-[13px] font-medium text-white/55 uppercase">
                {format(workoutDate, "MMM", { locale: getDateLocale() })}
              </span>
            </span>
            <span className="min-w-0 pb-1 text-right">
              <span className="block text-[10px] tracking-[0.12em] text-white/[0.48] uppercase">
                {format(workoutDate, "EEEE", {
                  locale: getDateLocale(),
                })}
              </span>
              <span className="mt-0.5 block max-w-44 truncate text-lg font-semibold text-white">
                {prediction.type}
              </span>
            </span>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 border-t border-white/10 pt-3">
            {weekDays.map((day) => {
              const active = isSameDay(day, workoutDate);
              return (
                <span
                  key={day.toISOString()}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className={
                      active
                        ? "text-[9px] font-semibold text-white"
                        : "text-[9px] font-medium text-white/[0.48]"
                    }
                  >
                    {format(day, "EEEEE", { locale: getDateLocale() })}
                  </span>
                  <span
                    className={
                      active
                        ? "h-1.5 w-4 rounded-full bg-lime shadow-[0_0_12px_rgba(215,246,81,0.65)]"
                        : "h-1.5 w-1.5 rounded-full bg-white/[0.26]"
                    }
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
