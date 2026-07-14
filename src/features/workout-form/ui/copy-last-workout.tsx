"use client";

import { useMuscleGroups } from "@/entities/muscle-group";
import { useLastWorkoutOfType } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { formatDay } from "@/shared/lib/dates";
import type { Unit } from "@/shared/lib/weight";
import { IconHistory } from "@/shared/ui";
import { workoutToDraft, type DraftExercise } from "../model/draft";

interface CopyLastWorkoutProps {
  /** Workout type selected in the form — the last workout of this type is offered. */
  type: string;
  unit: Unit;
  onCopy: (exercises: DraftExercise[]) => void;
}

/**
 * "Copy last {type} workout" — appends every exercise (with all its sets,
 * weights and reps) from the user's most recent workout of the selected type.
 */
export function CopyLastWorkout({ type, unit, onCopy }: CopyLastWorkoutProps) {
  const { t, tn } = useI18n();
  const { data: groups } = useMuscleGroups();
  const { data: last } = useLastWorkoutOfType(type);

  if (!last || last.workout_exercises.length === 0) return null;

  function copy() {
    if (!last) return;
    const groupNames = new Map((groups ?? []).map((g) => [g.id, g.name]));
    onCopy(workoutToDraft(last, groupNames, unit).exercises);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex w-full items-center gap-3 rounded-card border border-dashed border-line bg-surface/50 px-4 py-3.5 text-left active:bg-surface"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-lime">
        <IconHistory size={17} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-text">
          {t("workout.copyLast", { type })}
        </span>
        <span className="block text-xs text-muted">
          {formatDay(last.date)} ·{" "}
          {tn("count.exercises", last.workout_exercises.length)}
        </span>
      </span>
    </button>
  );
}
