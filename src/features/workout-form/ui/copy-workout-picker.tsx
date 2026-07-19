"use client";

import { useMemo, useState } from "react";
import { useMuscleGroups } from "@/entities/muscle-group";
import { getWorkout, useWorkoutSummaries } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { formatDay } from "@/shared/lib/dates";
import type { Unit } from "@/shared/lib/weight";
import { Calendar, ErrorNote, IconCalendar, Sheet, Spinner } from "@/shared/ui";
import { workoutToDraft, type DraftExercise } from "../model/draft";
import styles from "./copy-workout-picker.module.scss";

interface CopyWorkoutPickerProps {
  unit: Unit;
  /** Copied exercises plus the source workout's type (to align the draft). */
  onCopy: (exercises: DraftExercise[], type: string) => void;
}

/**
 * "Copy from another day" — a calendar of every logged session. Picking a
 * marked day lists that day's workouts; tapping one copies its exercises
 * (sets, weights, reps) into the draft and adopts its type.
 */
export function CopyWorkoutPicker({ unit, onCopy }: CopyWorkoutPickerProps) {
  const { t, tn } = useI18n();
  const { data: groups } = useMuscleGroups();
  const { data: summaries } = useWorkoutSummaries();
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
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

  async function copy(id: string, type: string) {
    if (copyingId) return;
    setError(null);
    setCopyingId(id);
    try {
      const workout = await getWorkout(id);
      const groupNames = new Map((groups ?? []).map((g) => [g.id, g.name]));
      onCopy(workoutToDraft(workout, groupNames, unit).exercises, type);
      setCopyingId(null);
      setOpen(false);
      setSelectedDay(null);
    } catch {
      setCopyingId(null);
      setError(t("common.error"));
    }
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
                  onClick={() => copy(workout.id, workout.type)}
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
    </>
  );
}
