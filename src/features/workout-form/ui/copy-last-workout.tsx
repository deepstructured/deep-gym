"use client";

import { useState } from "react";
import { useMuscleGroups } from "@/entities/muscle-group";
import { normalizeTrainingSchedule, useProfile } from "@/entities/user";
import { useLastWorkoutOfType } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { formatDay } from "@/shared/lib/dates";
import type { Unit } from "@/shared/lib/weight";
import { IconHistory } from "@/shared/ui";
import {
  workoutToCopiedExercises,
  type DraftExercise,
  type WorkoutCopyMode,
} from "../model/draft";
import { CopyModeSheet } from "./copy-mode-sheet";
import styles from "./copy-last-workout.module.scss";

interface CopyLastWorkoutProps {
  /** Workout type selected in the form — the last workout of this type is offered. */
  type: string;
  /** The draft's date — source cutoff and same-weekday preference anchor. */
  date: string;
  unit: Unit;
  onCopy: (exercises: DraftExercise[]) => void;
}

/**
 * "Copy last {type} workout" — selects the most recent eligible source, then
 * asks whether to bring over all sets or one blank set with the last weight.
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
  const [modeOpen, setModeOpen] = useState(false);

  const schedule = normalizeTrainingSchedule(profile?.training_schedule);
  const typeRunsOnSeveralDays =
    schedule.filter((slot) => slot === type).length >= 2;
  const { data: last } = useLastWorkoutOfType(
    type,
    date,
    typeRunsOnSeveralDays ? date : null,
  );

  if (!last || last.workout_exercises.length === 0) return null;

  function copy(mode: WorkoutCopyMode) {
    if (!last) return;
    const groupNames = new Map((groups ?? []).map((g) => [g.id, g.name]));
    onCopy(workoutToCopiedExercises(last, groupNames, unit, mode));
    setModeOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModeOpen(true)}
        className={styles.button}
      >
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

      <CopyModeSheet
        open={modeOpen}
        onClose={() => setModeOpen(false)}
        onSelect={copy}
      />
    </>
  );
}
