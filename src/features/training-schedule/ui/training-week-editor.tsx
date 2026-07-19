"use client";

import { addDays, format } from "date-fns";
import { useMemo } from "react";
import { useMuscleGroups } from "@/entities/muscle-group";
import {
  WEEKDAY_INDICES,
  type TrainingSchedule,
  type WeekdayIndex,
} from "@/entities/user";
import { BASE_WORKOUT_TYPES } from "@/shared/config/workout";
import { useI18n, type MessageKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { getDateLocale } from "@/shared/lib/dates";
import { IconChevronDown, Toggle } from "@/shared/ui";
import {
  hasIncompleteTrainingDays,
  type TrainingWeekPreset,
  type TrainingWeekPresetId,
} from "../model/presets";
import styles from "./training-week-editor.module.scss";

const MONDAY = new Date(2024, 0, 1);
type BaseWorkoutType = (typeof BASE_WORKOUT_TYPES)[number];

const BASE_WORKOUT_TYPE_LABEL_KEYS = {
  Upper: "workoutType.upper",
  Lower: "workoutType.lower",
  "Full Body": "workoutType.fullBody",
  Push: "workoutType.push",
  Pull: "workoutType.pull",
} as const satisfies Record<BaseWorkoutType, MessageKey>;

export interface TrainingWeekEditorProps {
  value: TrainingSchedule;
  onChange: (value: TrainingSchedule) => void;
  quickPresets?: readonly TrainingWeekPreset[];
  presetLabels?: Partial<Record<TrainingWeekPresetId, string>>;
  disabled?: boolean;
  showIncompleteMessage?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** A controlled schedule editor. Persistence belongs to the consuming flow. */
export function TrainingWeekEditor({
  value,
  onChange,
  quickPresets,
  presetLabels,
  disabled = false,
  showIncompleteMessage = true,
  className,
  ariaLabel,
}: TrainingWeekEditorProps) {
  const { t, lang } = useI18n();
  const { data: groups } = useMuscleGroups();

  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...BASE_WORKOUT_TYPES,
          ...(groups?.map((group) => `Split ${group.name}`) ?? []),
          ...value.filter((type): type is string => Boolean(type?.trim())),
        ]),
      ),
    [groups, value],
  );

  function setDayEnabled(weekday: WeekdayIndex, enabled: boolean) {
    const next = [...value] as TrainingSchedule;
    // An enabled day intentionally starts without a type: the user chooses.
    next[weekday] = enabled ? "" : null;
    onChange(next);
  }

  function setDayType(weekday: WeekdayIndex, type: string) {
    const next = [...value] as TrainingSchedule;
    next[weekday] = type;
    onChange(next);
  }

  function applyPreset(preset: TrainingWeekPreset) {
    onChange([...preset.value] as TrainingSchedule);
  }

  return (
    <fieldset
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(styles.editor, className)}
    >
      {quickPresets && quickPresets.length > 0 && (
        <div className={styles.presets}>
          {quickPresets.map((preset) => {
            const label = presetLabels?.[preset.id] ?? String(preset.dayCount);
            const selected = schedulesMatch(value, preset.value);

            return (
              <button
                key={preset.id}
                type="button"
                aria-label={label}
                aria-pressed={selected}
                onClick={() => applyPreset(preset)}
                className={cn(
                  styles.preset,
                  selected && styles.presetSelected,
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {WEEKDAY_INDICES.map((weekday) => {
        // lang intentionally participates in the render for date-fns locale.
        void lang;
        const day = capitalize(
          format(addDays(MONDAY, weekday), "EEEE", {
            locale: getDateLocale(),
          }),
        );
        const enabled = value[weekday] !== null;

        return (
          <div
            key={weekday}
            className={cn(styles.day, enabled && styles.dayEnabled)}
          >
            <div className={styles.dayHeader}>
              <div className={styles.dayText}>
                <p className={styles.dayName}>{day}</p>
                {!enabled && (
                  <p className={styles.restNote}>{t("settings.restDay")}</p>
                )}
              </div>
              <Toggle
                checked={enabled}
                onChange={(checked) => setDayEnabled(weekday, checked)}
                label={t("settings.toggleTrainingDay", { day })}
                tone="lime"
              />
            </div>

            {enabled && (
              <div className={styles.selectWrap}>
                <select
                  value={value[weekday] ?? ""}
                  onChange={(event) => setDayType(weekday, event.target.value)}
                  aria-label={t("settings.workoutTypeFor", { day })}
                  className={styles.select}
                >
                  <option value="">{t("settings.chooseWorkoutType")}</option>
                  {typeOptions.map((type) => {
                    const labelKey = isBaseWorkoutType(type)
                      ? BASE_WORKOUT_TYPE_LABEL_KEYS[type]
                      : null;
                    return (
                      <option key={type} value={type}>
                        {labelKey ? t(labelKey) : type}
                      </option>
                    );
                  })}
                </select>
                <IconChevronDown size={16} className={styles.selectChevron} />
              </div>
            )}
          </div>
        );
      })}

      {showIncompleteMessage && hasIncompleteTrainingDays(value) && (
        <p className={styles.incompleteNote}>
          {t("settings.chooseTypeForEnabled")}
        </p>
      )}
    </fieldset>
  );
}

function schedulesMatch(
  left: TrainingSchedule,
  right: TrainingSchedule,
): boolean {
  return WEEKDAY_INDICES.every((weekday) => left[weekday] === right[weekday]);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isBaseWorkoutType(value: string): value is BaseWorkoutType {
  return value in BASE_WORKOUT_TYPE_LABEL_KEYS;
}
