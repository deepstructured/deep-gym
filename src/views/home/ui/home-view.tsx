"use client";

import clsx from "clsx";
import { addDays, differenceInCalendarWeeks, subDays } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useProfile } from "@/entities/user";
import {
  WorkoutCard,
  useWorkoutCount,
  useWorkouts,
} from "@/entities/workout";
import { ProgressExplorer } from "@/features/exercise-stats";
import { FirstWorkoutGuideCard } from "@/features/first-workout";
import { NextWorkoutCard } from "@/features/next-workout";
import { useI18n } from "@/shared/i18n";
import { formatDayFull, toISODate, todayISO } from "@/shared/lib/dates";
import { AppShell } from "@/widgets/app-shell";
import {
  Avatar,
  BrandMark,
  Card,
  DotValue,
  EmptyState,
  IconChevronRight,
  IconDumbbell,
  IconFlame,
  IconHistory,
  IconPlus,
} from "@/shared/ui";

/** Consecutive weeks (incl. this one) with at least one workout. */
function weekStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const now = new Date();
  const weeks = new Set(
    dates.map((date) =>
      differenceInCalendarWeeks(now, new Date(date), { weekStartsOn: 1 }),
    ),
  );
  let streak = 0;
  // Week 0 = current week; streak may also start from last week (week 1)
  let week = weeks.has(0) ? 0 : 1;
  while (weeks.has(week)) {
    streak++;
    week++;
  }
  return streak;
}

export function HomeView() {
  const router = useRouter();
  const { t, tn } = useI18n();
  const { data: profile } = useProfile();

  const from = toISODate(subDays(new Date(), 180));
  const to = todayISO();
  const { data: workouts } = useWorkouts(from, to);
  const { data: workoutCount } = useWorkoutCount();

  const unit = profile?.unit ?? "kg";

  const stats = useMemo(() => {
    const list = workouts ?? [];
    const thisWeekStart = subDays(
      new Date(),
      (new Date().getDay() + 6) % 7, // days since Monday
    );
    const weekFrom = toISODate(thisWeekStart);
    const thisWeekDates = new Set(
      list.filter((w) => w.date >= weekFrom).map((w) => w.date),
    );
    return {
      thisWeek: list.filter((w) => w.date >= weekFrom).length,
      weekDays: Array.from({ length: 7 }, (_, index) =>
        thisWeekDates.has(toISODate(addDays(thisWeekStart, index))),
      ),
      currentWeekday: (new Date().getDay() + 6) % 7,
      streak: weekStreak(list.map((w) => w.date)),
      total: workoutCount ?? 0,
    };
  }, [workoutCount, workouts]);

  const recent = (workouts ?? []).slice(0, 3);
  const firstName = profile?.display_name?.split(" ")[0] ?? t("home.athlete");

  // Recent-workouts slider: dot indicator follows the slide closest to center.
  const sliderRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  function handleSliderScroll() {
    const el = sliderRef.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let minDistance = Infinity;
    Array.from(el.children).forEach((child, index) => {
      const slide = child as HTMLElement;
      const distance = Math.abs(
        slide.offsetLeft + slide.offsetWidth / 2 - center,
      );
      if (distance < minDistance) {
        minDistance = distance;
        closest = index;
      }
    });
    setActiveSlide(closest);
  }

  return (
    <AppShell>
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <BrandMark width={22} />
            <p className="text-sm text-muted">{formatDayFull(todayISO())}</p>
          </div>
          <h1 className="truncate text-2xl font-semibold">
            {t("home.greeting", { name: firstName })}
          </h1>
        </div>
        <Link
          href="/settings"
          aria-label={t("nav.settings")}
          className="shrink-0"
        >
          <Avatar
            src={profile?.avatar_url}
            size={46}
            alt={profile?.display_name ?? ""}
          />
        </Link>
      </header>

      <div className="space-y-5">
        {/* Main CTA */}
        <Link
          href={workoutCount === 0 ? "/workouts/new?first=1" : "/workouts/new"}
          className="block"
        >
          <Card variant="pink" className="p-6">
            <div className="dots-bg pointer-events-none absolute inset-0 opacity-25" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-xl font-semibold text-white">
                  {t("home.startWorkout")}
                </p>
                <p className="mt-1 text-sm text-white/70">
                  {t("home.logSession")}
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white">
                <IconPlus size={24} />
              </span>
            </div>
          </Card>
        </Link>

        {workoutCount === 0 && <FirstWorkoutGuideCard />}

        {/* Stats */}
        <div className="grid grid-cols-[1.08fr_1fr] grid-rows-2 gap-3">
          <Card
            variant="surface"
            className="stat-well row-span-2 flex min-h-48 flex-col rounded-tile p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="max-w-24 text-[10px] leading-[1.35] font-semibold tracking-[0.11em] text-muted uppercase">
                {t("home.workoutsThisWeek")}
              </p>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-lime/20 bg-lime/10 text-lime">
                <IconDumbbell size={16} />
              </span>
            </div>
            <DotValue
              value={stats.thisWeek}
              className="mt-5 text-[48px] text-lime"
            />
            <div
              aria-hidden="true"
              className="mt-auto grid grid-cols-7 items-end gap-1 pt-5"
            >
              {stats.weekDays.map((hasWorkout, index) => (
                <span
                  key={index}
                  className={clsx(
                    "mx-auto w-1 rounded-full transition-all",
                    hasWorkout
                      ? "h-4 bg-lime shadow-[0_0_12px_rgba(215,246,81,0.45)]"
                      : "h-1.5 bg-white/12",
                    index === stats.currentWeekday &&
                      !hasWorkout &&
                      "bg-white/30",
                  )}
                />
              ))}
            </div>
          </Card>
          <Card
            variant="indigo"
            className="flex min-h-22 flex-col rounded-tile p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] leading-[1.35] font-semibold tracking-[0.11em] text-white/60 uppercase">
                {t("home.weekStreak")}
              </p>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white/80">
                <IconFlame size={14} />
              </span>
            </div>
            <DotValue
              value={stats.streak}
              suffix={t("home.wk")}
              className="mt-auto text-[30px] text-white"
              suffixClassName="text-white/55"
            />
          </Card>
          <Card
            variant="surface"
            className="stat-well flex min-h-22 flex-col rounded-tile p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] leading-[1.35] font-semibold tracking-[0.11em] text-muted uppercase">
                {t("home.totalWorkouts")}
              </p>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/5 text-white/55">
                <IconHistory size={14} />
              </span>
            </div>
            <DotValue value={stats.total} className="mt-auto text-[30px]" />
          </Card>
        </div>

        {/* Next workout — driven by the user's explicit training week */}
        <NextWorkoutCard
          schedule={profile?.training_schedule}
          workouts={workouts}
        />

        {/* Recent workouts */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">
              {tn("count.lastWorkouts", recent.length)}
            </h2>
            <Link
              href="/history"
              className="flex items-center gap-0.5 text-sm text-muted"
            >
              {t("home.allHistory")}
              <IconChevronRight size={15} />
            </Link>
          </div>

          {recent.length === 0 ? (
            <EmptyState
              title={t("home.emptyTitle")}
              hint={t("home.emptyHint")}
            />
          ) : (
            <>
              <div
                ref={sliderRef}
                onScroll={handleSliderScroll}
                className="no-scrollbar -mx-5 flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto px-5"
              >
                {recent.map((workout) => (
                  <div
                    key={workout.id}
                    className={clsx(
                      "shrink-0 snap-center",
                      recent.length === 1 ? "w-full" : "w-[85%]",
                    )}
                  >
                    <WorkoutCard
                      workout={workout}
                      unit={unit}
                      showDate
                      className="h-full"
                      onEdit={() => router.push(`/workouts/${workout.id}/edit`)}
                    />
                  </div>
                ))}
              </div>

              {recent.length > 1 && (
                <div className="mt-3 flex justify-center gap-1.5">
                  {recent.map((workout, index) => (
                    <span
                      key={workout.id}
                      className={clsx(
                        "h-1.5 rounded-full transition-all duration-300",
                        index === activeSlide ? "w-5 bg-lime" : "w-1.5 bg-line",
                      )}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Exercise progress explorer */}
        <ProgressExplorer workouts={workouts} unit={unit} />
      </div>
    </AppShell>
  );
}
