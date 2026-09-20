"use client";

import { useMemo } from "react";
import { useExerciseHistory } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { formatDay } from "@/shared/lib/dates";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";
import styles from "./previous-sets.module.scss";

export interface PreviousSet {
  weight: string;
  reps: string;
  warmup: boolean;
}

interface PreviousSession {
  date: string;
  sets: PreviousSet[];
}

/**
 * The same exercise's most recent session before `beforeDate`, as display
 * strings. The desktop set table shows it next to the inputs so the athlete
 * can beat last time without opening the compare sheet.
 */
export function usePreviousSession(
  exerciseId: string,
  beforeDate: string,
  unit: Unit,
  bodyweight: boolean,
  bodyWeightKg: number | null,
): PreviousSession | null {
  const { data: history } = useExerciseHistory(exerciseId);

  return useMemo(() => {
    if (!history?.length) return null;

    // Latest workout strictly before the draft's date.
    const earlier = history.filter((record) => record.workoutDate < beforeDate);
    if (earlier.length === 0) return null;
    const date = earlier.reduce(
      (latest, record) =>
        record.workoutDate > latest ? record.workoutDate : latest,
      earlier[0].workoutDate,
    );

    const sets = earlier
      .filter((record) => record.workoutDate === date)
      .sort((a, b) => a.position - b.position)
      .map((record) => {
        const warmup = record.set_type === "warmup";
        if (record.weight_kg == null) {
          return { weight: "—", reps: String(record.reps ?? "—"), warmup };
        }
        // Bodyweight exercises are stored as the total load; the useful
        // number to beat is the added load on top of the athlete.
        const base = bodyweight ? (record.body_weight_kg ?? bodyWeightKg) : null;
        const shownKg =
          bodyweight && base != null ? record.weight_kg - base : record.weight_kg;
        const value = roundWeight(kgToUnit(shownKg, unit));
        const normalized = Object.is(value, -0) ? 0 : value;
        return {
          weight:
            bodyweight && base != null
              ? normalized >= 0
                ? `+${normalized}`
                : String(normalized)
              : String(normalized),
          reps: String(record.reps ?? "—"),
          warmup,
        };
      });

    return sets.length > 0 ? { date, sets } : null;
  }, [history, beforeDate, unit, bodyweight, bodyWeightKg]);
}

/** One cell of the desktop set table: what this set looked like last time. */
export function PreviousSetCell({ set }: { set: PreviousSet | undefined }) {
  if (!set) return <span className={styles.empty}>—</span>;
  return (
    <span className={set.warmup ? styles.warmup : styles.value}>
      {set.weight} × {set.reps}
    </span>
  );
}

/** Column header naming the session the reference column comes from. */
export function PreviousSetsLabel({ date }: { date: string | undefined }) {
  const { t } = useI18n();
  return (
    <span className={styles.label} title={date ? formatDay(date) : undefined}>
      {date ? formatDay(date) : t("workout.previousSession")}
    </span>
  );
}
