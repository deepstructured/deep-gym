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
      className={cn(
        "m-0 min-w-0 space-y-2 border-0 p-0 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {quickPresets && quickPresets.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pb-2">
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
                  "h-11 rounded-full border text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
                  selected
                    ? "border-lime/40 bg-lime/10 text-lime"
                    : "border-line bg-raised/70 text-muted active:bg-line/60",
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
            className={cn(
              "rounded-tile border px-3.5 py-3 transition-colors",
              enabled
                ? "border-lime/20 bg-lime/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
                : "border-line/70 bg-raised/70",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{day}</p>
                {!enabled && (
                  <p className="mt-0.5 text-xs text-faint">
                    {t("settings.restDay")}
                  </p>
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
              <div className="relative mt-3">
                <select
                  value={value[weekday] ?? ""}
                  onChange={(event) => setDayType(weekday, event.target.value)}
                  aria-label={t("settings.workoutTypeFor", { day })}
                  className="h-11 w-full appearance-none rounded-xl border border-line bg-surface pr-10 pl-3.5 text-sm text-text outline-none focus:border-lime/50 disabled:opacity-50"
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
                <IconChevronDown
                  size={16}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-faint"
                />
              </div>
            )}
          </div>
        );
      })}

      {showIncompleteMessage && hasIncompleteTrainingDays(value) && (
        <p className="pt-2 text-xs text-flame">
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
