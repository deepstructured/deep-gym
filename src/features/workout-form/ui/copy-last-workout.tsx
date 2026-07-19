"use client";

import { useMuscleGroups } from "@/entities/muscle-group";
import { normalizeTrainingSchedule, useProfile } from "@/entities/user";
import { useLastWorkoutOfType } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { formatDay } from "@/shared/lib/dates";
import type { Unit } from "@/shared/lib/weight";
import { IconHistory } from "@/shared/ui";
import { workoutToDraft, type DraftExercise } from "../model/draft";
import styles from "./copy-last-workout.module.scss";

interface CopyLastWorkoutProps {
  /** Workout type selected in the form — the last workout of this type is offered. */
  type: string;
  /** The draft's date — anchors the same-weekday preference below. */
  date: string;
  unit: Unit;
  onCopy: (exercises: DraftExercise[]) => void;
}

/**
 * "Copy last {type} workout" — appends every exercise (with all its sets,
 * weights and reps) from the user's most recent workout of the selected type.
 *
 * When the training schedule runs this type on several weekdays (e.g. Full
 * Body on Wed/Fri/Sun), the offer sticks to the draft date's weekday: on a
 * Sunday it suggests last Sunday's session, not Friday's.
 */
export function CopyLastWorkout({
  type,
  date,
  unit,
  onCopy,
}: CopyLastWorkoutProps) {
  const { t, tn } = useI18n();
  const { data: groups } = useMuscleGroups();
  const { data: profile } = useProfile();

  const schedule = normalizeTrainingSchedule(profile?.training_schedule);
  const typeRunsOnSeveralDays =
    schedule.filter((slot) => slot === type).length >= 2;
  const { data: last } = useLastWorkoutOfType(
    type,
    typeRunsOnSeveralDays ? date : null,
  );

  if (!last || last.workout_exercises.length === 0) return null;

  function copy() {
    if (!last) return;
    const groupNames = new Map((groups ?? []).map((g) => [g.id, g.name]));
    onCopy(workoutToDraft(last, groupNames, unit).exercises);
  }

  return (
    <button type="button" onClick={copy} className={styles.button}>
      <span className={styles.icon}>
        <IconHistory size={17} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{t("workout.copyLast", { type })}</span>
        <span className={styles.meta}>
          {formatDay(last.date)} ·{" "}
          {tn("count.exercises", last.workout_exercises.length)}
        </span>
      </span>
    </button>
  );
}
