"use client";

import clsx from "clsx";
import { differenceInCalendarWeeks, subDays } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useProfile } from "@/entities/user";
import { WorkoutCard, useWorkouts } from "@/entities/workout";
import { ProgressExplorer } from "@/features/exercise-stats";
import { NextWorkoutCard } from "@/features/next-workout";
import { useI18n } from "@/shared/i18n";
import { formatDayFull, toISODate, todayISO } from "@/shared/lib/dates";
import { AppShell } from "@/widgets/app-shell";
import {
  Avatar,
  Card,
  DotValue,
  EmptyState,
  IconChevronRight,
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

  const unit = profile?.unit ?? "kg";

  const stats = useMemo(() => {
    const list = workouts ?? [];
    const thisWeekStart = subDays(
      new Date(),
      (new Date().getDay() + 6) % 7, // days since Monday
    );
    const weekFrom = toISODate(thisWeekStart);
    return {
      thisWeek: list.filter((w) => w.date >= weekFrom).length,
      streak: weekStreak(list.map((w) => w.date)),
      total: list.length,
    };
  }, [workouts]);

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
          <p className="text-sm text-muted">{formatDayFull(todayISO())}</p>
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
        <Link href="/workouts/new" className="block">
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card variant="surface" className="rounded-tile p-4">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-faint uppercase">
              {t("home.week")}
            </p>
            <DotValue value={stats.thisWeek} className="text-3xl text-lime" />
          </Card>
          <Card variant="indigo" className="rounded-tile p-4">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-white/60 uppercase">
              {t("home.streak")}
            </p>
            <DotValue
              value={stats.streak}
              suffix={t("home.wk")}
              className="text-3xl text-white"
              suffixClassName="text-white/60"
            />
          </Card>
          <Card variant="surface" className="rounded-tile p-4">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-faint uppercase">
              {t("home.total")}
            </p>
            <DotValue value={stats.total} className="text-3xl" />
          </Card>
        </div>

        {/* Next workout — appears once a weekly rhythm is detected */}
        <NextWorkoutCard workouts={workouts} />

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
