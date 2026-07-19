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
import styles from "./home-view.module.scss";

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
      <header className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.dateRow}>
            <BrandMark width={22} />
            <p className={styles.date}>{formatDayFull(todayISO())}</p>
          </div>
          <h1 className={styles.greeting}>
            {t("home.greeting", { name: firstName })}
          </h1>
        </div>
        <Link
          href="/settings"
          aria-label={t("nav.settings")}
          className={styles.avatarLink}
        >
          <Avatar
            src={profile?.avatar_url}
            size={46}
            alt={profile?.display_name ?? ""}
          />
        </Link>
      </header>

      <div className={styles.stack}>
        {/* Main CTA */}
        <Link
          href={workoutCount === 0 ? "/workouts/new?first=1" : "/workouts/new"}
          className={styles.ctaLink}
        >
          <Card variant="pink" className={styles.ctaCard}>
            <div className={clsx(styles.ctaDots, "dots-bg")} />
            <div className={styles.ctaRow}>
              <div>
                <p className={styles.ctaTitle}>
                  {t("home.startWorkout")}
                </p>
                <p className={styles.ctaSubtitle}>{t("home.logSession")}</p>
              </div>
              <span className={styles.ctaPlus}>
                <IconPlus size={24} />
              </span>
            </div>
          </Card>
        </Link>

        {workoutCount === 0 && <FirstWorkoutGuideCard />}

        {/* Stats */}
        <div className={styles.statsGrid}>
          <Card
            variant="surface"
            className={clsx(styles.weekCard, "stat-well")}
          >
            <div className={styles.statHead}>
              <p className={clsx(styles.statLabel, styles.statLabelNarrow)}>
                {t("home.workoutsThisWeek")}
              </p>
              <span className={styles.weekIcon}>
                <IconDumbbell size={16} />
              </span>
            </div>
            <DotValue value={stats.thisWeek} className={styles.weekValue} />
            <div aria-hidden="true" className={styles.weekBars}>
              {stats.weekDays.map((hasWorkout, index) => (
                <span
                  key={index}
                  className={clsx(
                    styles.weekBar,
                    hasWorkout && styles.weekBarActive,
                    index === stats.currentWeekday &&
                      !hasWorkout &&
                      styles.weekBarToday,
                  )}
                />
              ))}
            </div>
          </Card>
          <Card variant="indigo" className={styles.statCard}>
            <div className={styles.statHead}>
              <p className={clsx(styles.statLabel, styles.statLabelOnGradient)}>
                {t("home.weekStreak")}
              </p>
              <span className={styles.streakIcon}>
                <IconFlame size={14} />
              </span>
            </div>
            <DotValue
              value={stats.streak}
              suffix={t("home.wk")}
              className={styles.streakValue}
              suffixClassName={styles.streakSuffix}
            />
          </Card>
          <Card
            variant="surface"
            className={clsx(styles.statCard, "stat-well")}
          >
            <div className={styles.statHead}>
              <p className={styles.statLabel}>{t("home.totalWorkouts")}</p>
              <span className={styles.totalIcon}>
                <IconHistory size={14} />
              </span>
            </div>
            <DotValue value={stats.total} className={styles.totalValue} />
          </Card>
        </div>

        {/* Next workout — driven by the user's explicit training week */}
        <NextWorkoutCard
          schedule={profile?.training_schedule}
          workouts={workouts}
        />

        {/* Recent workouts */}
        <div>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              {tn("count.lastWorkouts", recent.length)}
            </h2>
            <Link href="/history" className={styles.sectionLink}>
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
                className={clsx(styles.slider, "no-scrollbar")}
              >
                {recent.map((workout) => (
                  <div
                    key={workout.id}
                    className={clsx(
                      styles.slide,
                      recent.length === 1 && styles.slideFull,
                    )}
                  >
                    <WorkoutCard
                      workout={workout}
                      unit={unit}
                      showDate
                      className={styles.slideCard}
                      onEdit={() => router.push(`/workouts/${workout.id}/edit`)}
                    />
                  </div>
                ))}
              </div>

              {recent.length > 1 && (
                <div className={styles.sliderDots}>
                  {recent.map((workout, index) => (
                    <span
                      key={workout.id}
                      className={clsx(
                        styles.sliderDot,
                        index === activeSlide && styles.sliderDotActive,
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
