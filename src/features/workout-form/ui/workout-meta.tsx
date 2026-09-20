"use client";

import { useMuscleGroups } from "@/entities/muscle-group";
import { BASE_WORKOUT_TYPES } from "@/shared/config/workout";
import { useI18n } from "@/shared/i18n";
import { IconChevronDown } from "@/shared/ui";
import styles from "./workout-meta.module.scss";

export function workoutTypeOptions(groupNames: string[]): string[] {
  return [...BASE_WORKOUT_TYPES, ...groupNames.map((name) => `Split ${name}`)];
}

/**
 * Type and date for the desktop top bar. The phone keeps the scrollable
 * chip row inside the form — with eleven types it is the faster target for
 * a thumb, but on a wide screen it cost a whole band of vertical space for
 * a single choice.
 */
export function WorkoutMetaControls({
  type,
  date,
  onTypeChange,
  onDateChange,
}: {
  type: string;
  date: string;
  onTypeChange: (type: string) => void;
  onDateChange: (date: string) => void;
}) {
  const { t } = useI18n();
  const { data: groups } = useMuscleGroups();
  const options = workoutTypeOptions((groups ?? []).map((group) => group.name));
  // A stored type can be a group that no longer exists — keep it listed so
  // the select never silently changes the draft.
  const all = options.includes(type) ? options : [type, ...options];

  return (
    <div className={styles.meta}>
      <label className={styles.field}>
        <span className={styles.srOnly}>{t("workout.type")}</span>
        <select
          value={type}
          onChange={(event) => onTypeChange(event.target.value)}
          className={styles.select}
        >
          {all.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <IconChevronDown size={15} className={styles.chevron} />
      </label>

      <label className={styles.field}>
        <span className={styles.srOnly}>{t("workout.date")}</span>
        <input
          type="date"
          value={date}
          onChange={(event) =>
            event.target.value && onDateChange(event.target.value)
          }
          className={styles.date}
        />
      </label>
    </div>
  );
}
