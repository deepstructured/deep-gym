"use client";

import { useMemo, useState } from "react";
import { useMuscleGroups } from "@/entities/muscle-group";
import {
  getWorkout,
  useWorkoutSummaries,
  type Workout,
} from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { formatDay } from "@/shared/lib/dates";
import type { Unit } from "@/shared/lib/weight";
import { Calendar, ErrorNote, IconCalendar, Sheet, Spinner } from "@/shared/ui";
import {
  workoutToCopiedExercises,
  type DraftExercise,
  type WorkoutCopyMode,
} from "../model/draft";
import { CopyModeSheet } from "./copy-mode-sheet";
import styles from "./copy-workout-picker.module.scss";

interface CopyWorkoutPickerProps {
  unit: Unit;
  /** Copied exercises plus the source workout's type (to align the draft). */
  onCopy: (exercises: DraftExercise[], type: string) => void;
}

/**
 * "Copy from another day" — a calendar of every logged session. Picking a
 * marked day lists that day's workouts; tapping one loads it and asks which
 * copy mode to use. The copied draft adopts the source workout's type.
 */
export function CopyWorkoutPicker({ unit, onCopy }: CopyWorkoutPickerProps) {
  const { t, tn } = useI18n();
  const { data: groups } = useMuscleGroups();
  const { data: summaries } = useWorkoutSummaries();
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [sourceWorkout, setSourceWorkout] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);

  const markedDates = useMemo(
    () => new Set((summaries ?? []).map((workout) => workout.date)),
    [summaries],
  );

  if (!summaries || summaries.length === 0) return null;

  const dayWorkouts = selectedDay
    ? summaries.filter((workout) => workout.date === selectedDay)
    : [];

  function close() {
    if (copyingId) return;
    setOpen(false);
    setSelectedDay(null);
    setError(null);
  }

  async function chooseSource(id: string) {
    if (copyingId) return;
    setError(null);
    setCopyingId(id);
    try {
      const workout = await getWorkout(id);
      setCopyingId(null);
      setOpen(false);
      setSelectedDay(null);
      setSourceWorkout(workout);
    } catch {
      setCopyingId(null);
      setError(t("common.error"));
    }
  }

  function copy(mode: WorkoutCopyMode) {
    if (!sourceWorkout) return;
    const groupNames = new Map((groups ?? []).map((g) => [g.id, g.name]));
    onCopy(
      workoutToCopiedExercises(sourceWorkout, groupNames, unit, mode),
      sourceWorkout.type,
    );
    setSourceWorkout(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={styles.trigger}
      >
        <IconCalendar size={16} />
        {t("workout.copyFromCalendar")}
      </button>

      <Sheet open={open} onClose={close} title={t("workout.copyPickerTitle")}>
        <div className={styles.body}>
          <Calendar
            value={selectedDay}
            onChange={setSelectedDay}
            markedDates={markedDates}
          />

          {selectedDay == null ? (
            <p className={styles.hint}>{t("workout.copyPickerHint")}</p>
          ) : dayWorkouts.length === 0 ? (
            <p className={styles.hint}>{t("workout.copyPickerEmptyDay")}</p>
          ) : (
            <div className={styles.workouts}>
              {dayWorkouts.map((workout) => (
                <button
                  key={workout.id}
                  type="button"
                  disabled={copyingId != null}
                  onClick={() => chooseSource(workout.id)}
                  className={styles.workoutRow}
                >
                  <span className={styles.icon}>
                    {copyingId === workout.id ? (
                      <Spinner size={16} />
                    ) : (
                      <IconCalendar size={16} />
                    )}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.title}>
                      {t("workout.copyThis", { type: workout.type })}
                    </span>
                    <span className={styles.meta}>
                      {formatDay(workout.date)} ·{" "}
                      {tn("count.exercises", workout.exerciseCount)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {error && <ErrorNote message={error} />}
        </div>
      </Sheet>

      <CopyModeSheet
        open={sourceWorkout != null}
        onClose={() => setSourceWorkout(null)}
        onSelect={copy}
      />
    </>
  );
}
