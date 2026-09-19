"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { WorkoutCard } from "@/entities/workout";
import { useWorkoutTemplates } from "@/entities/workout-template";
import {
  ScheduledWorkoutCard,
  nextScheduledWorkout,
} from "@/features/next-workout";
import { workoutSetCount } from "@/features/training-analytics";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatDay } from "@/shared/lib/dates";
import {
  IconCalendar,
  IconChart,
  IconChevronRight,
  IconPlay,
  IconPlus,
  IconRepeat,
  IconScale,
  IconTemplate,
} from "@/shared/ui";
import { useHomeData, type TileProps } from "../home-data";
import { Tile, TileHead } from "./tile";
import styles from "./tiles.module.scss";

export function NextTile() {
  const { t } = useI18n();
  const { workouts, profile, workoutsLoaded } = useHomeData();
  const prediction = useMemo(
    () =>
      workoutsLoaded
        ? nextScheduledWorkout(profile?.training_schedule, workouts)
        : null,
    [profile?.training_schedule, workouts, workoutsLoaded],
  );

  if (prediction) {
    return (
      <div className={styles.fill}>
        <ScheduledWorkoutCard prediction={prediction} />
      </div>
    );
  }
  return (
    <Tile href="/settings?open=schedule" variant="cherry">
      <TileHead
        label={t("home.nextWorkout")}
        icon={<IconCalendar size={15} />}
        tone="flame"
        onGradient
      />
      <div className={styles.bottom}>
        <p className={styles.listTitle}>{t("widget.nextWorkout.planTitle")}</p>
        <p className={styles.meta}>{t("widget.nextWorkout.planHint")}</p>
      </div>
    </Tile>
  );
}

export function TemplatesTile({ size }: TileProps) {
  const { t, tn } = useI18n();
  const { data: templates, isLoading } = useWorkoutTemplates();
  const list = templates ?? [];

  return (
    <Tile>
      <TileHead
        label={t("templates.title")}
        action={
          <Link href="/templates" className={styles.headLink}>
            {t("widget.all")}
            <IconChevronRight size={14} />
          </Link>
        }
      />
      {!isLoading && list.length === 0 ? (
        <div className={styles.bottom}>
          <p className={styles.meta}>{t("templates.emptyHint")}</p>
          <div className={cn(styles.chips, "no-scrollbar")}>
            <Link
              href="/templates/new"
              className={cn(styles.startChip, styles.newChip)}
            >
              <span className={styles.playDot}>
                <IconPlus size={15} />
              </span>
              <span>{t("templates.new")}</span>
            </Link>
          </div>
        </div>
      ) : size === "l" ? (
        <div className={styles.list}>
          {list.slice(0, 4).map((template) => (
            <div key={template.id} className={styles.listRow}>
              <Link
                href={`/templates/${template.id}`}
                className={styles.listText}
              >
                <span className={styles.listTitle}>{template.name}</span>
                <span className={styles.listMeta}>
                  {template.type} ·{" "}
                  {tn("count.exercises", template.exerciseCount)}
                </span>
              </Link>
              <Link
                href={`/workouts/new?template=${template.id}`}
                className={styles.startButton}
              >
                <IconPlay size={12} />
                {t("templates.start")}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn(styles.chips, styles.bottom, "no-scrollbar")}>
          {list.slice(0, 6).map((template) => (
            <Link
              key={template.id}
              href={`/workouts/new?template=${template.id}`}
              className={styles.startChip}
              aria-label={`${t("templates.startWorkout")}: ${template.name}`}
            >
              <span className={styles.playDot}>
                <IconPlay size={12} />
              </span>
              <span>{template.name}</span>
            </Link>
          ))}
        </div>
      )}
    </Tile>
  );
}

export function RecentTile({ size }: TileProps) {
  const router = useRouter();
  const { t, tn } = useI18n();
  const { workouts, unit, workoutsLoaded } = useHomeData();
  const recent = workouts.slice(0, 3);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  // Dot indicator follows the slide closest to the slider's center.
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

  const head = (
    <TileHead
      label={tn("count.lastWorkouts", Math.max(recent.length, 1))}
      action={
        <Link href="/history" className={styles.headLink}>
          {t("home.allHistory")}
          <IconChevronRight size={14} />
        </Link>
      }
    />
  );

  if (workoutsLoaded && recent.length === 0) {
    return (
      <Tile>
        {head}
        <div className={styles.bottom}>
          <p className={styles.listTitle}>{t("home.emptyTitle")}</p>
          <p className={styles.meta}>{t("home.emptyHint")}</p>
        </div>
      </Tile>
    );
  }

  if (size === "m") {
    return (
      <Tile>
        {head}
        <div className={styles.list}>
          {recent.map((workout) => (
            <Link
              key={workout.id}
              href={`/workouts/${workout.id}/edit`}
              className={styles.listRow}
            >
              <span className={styles.listText}>
                <span className={styles.listTitle}>{workout.type}</span>
                <span className={styles.listMeta}>
                  {formatDay(workout.date)} ·{" "}
                  {tn("count.exercises", workout.workout_exercises.length)}
                </span>
              </span>
              <span className={styles.listValue}>
                {workoutSetCount(workout)}
                <small> {t("widget.setsShort")}</small>
              </span>
            </Link>
          ))}
        </div>
      </Tile>
    );
  }

  return (
    <Tile className={styles.recent}>
      {head}
      <div
        ref={sliderRef}
        onScroll={handleSliderScroll}
        className={cn(styles.slider, "no-scrollbar")}
      >
        {recent.map((workout) => (
          <div
            key={workout.id}
            className={cn(
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
              className={cn(
                styles.sliderDot,
                index === activeSlide && styles.sliderDotActive,
              )}
            />
          ))}
        </div>
      )}
    </Tile>
  );
}

export function QuickActionsTile() {
  const { t } = useI18n();
  const { openWeightSheet } = useHomeData();
  return (
    <Tile>
      <TileHead label={t("widget.quickActions.title")} />
      <div className={styles.actions}>
        <Link href="/workouts/new" className={styles.action}>
          <span className={cn(styles.actionIcon, styles.actionPrimary)}>
            <IconPlus size={22} />
          </span>
          <span>{t("widget.quickActions.workout")}</span>
        </Link>
        <button type="button" onClick={openWeightSheet} className={styles.action}>
          <span className={styles.actionIcon}>
            <IconScale size={20} />
          </span>
          <span>{t("widget.quickActions.weight")}</span>
        </button>
        <Link href="/templates" className={styles.action}>
          <span className={styles.actionIcon}>
            <IconTemplate size={20} />
          </span>
          <span>{t("templates.title")}</span>
        </Link>
        <Link href="/progress" className={styles.action}>
          <span className={styles.actionIcon}>
            <IconChart size={20} />
          </span>
          <span>{t("nav.progress")}</span>
        </Link>
      </div>
    </Tile>
  );
}

export function RepeatTile() {
  const { t, tn } = useI18n();
  const { workouts } = useHomeData();
  const last = workouts[0];

  if (!last) {
    return (
      <Tile>
        <TileHead
          label={t("widget.repeatLast.title")}
          icon={<IconRepeat size={14} />}
        />
        <p className={styles.empty}>{t("home.emptyTitle")}</p>
      </Tile>
    );
  }
  return (
    <Tile href={`/workouts/new?repeat=${last.id}`}>
      <TileHead
        label={t("widget.repeatLast.title")}
        icon={<IconRepeat size={14} />}
        tone="lime"
      />
      <div className={styles.bottom}>
        <p className={styles.liveType}>{last.type}</p>
        <p className={styles.metaFaint}>
          {formatDay(last.date)} ·{" "}
          {tn("count.exercises", last.workout_exercises.length)}
        </p>
      </div>
    </Tile>
  );
}
