"use client";

import { useCallback, useMemo, useState } from "react";
import type { ExerciseSetRecord } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { createStoredPreference } from "@/shared/lib/preference";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";
import {
  loadOptions,
  type LoadFilter,
  type LoadFilterMode,
} from "../model/stats";
import styles from "./exercise-progress.module.scss";

const ALL: LoadFilter = { mode: "all" };

function isLoadMode(value: unknown): value is LoadFilterMode {
  return value === "all" || value === "working";
}

/** "All sets" vs "working sets" is remembered for every chart; working
 *  sets are the default because light days skew volume and reps. */
const usePreferredLoadMode = createStoredPreference<LoadFilterMode>(
  "deepgym-chart-load",
  "working",
  isLoadMode,
);

/** Effective load filter for one exercise: the remembered mode, or a
 *  specific load picked for this exercise (not remembered). Bodyweight
 *  exercises always count every set. */
export function useLoadFilterState(
  bodyweight: boolean,
): [LoadFilter, (next: LoadFilter) => void] {
  const [mode, setMode] = usePreferredLoadMode();
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const filter = useMemo<LoadFilter>(
    () =>
      bodyweight
        ? ALL
        : weightKg != null
          ? { mode: "weight", weightKg }
          : { mode },
    [bodyweight, mode, weightKg],
  );
  const setFilter = useCallback(
    (next: LoadFilter) => {
      if (next.mode === "weight") {
        setWeightKg(next.weightKg);
      } else {
        setWeightKg(null);
        setMode(next.mode);
      }
    },
    [setMode],
  );
  return [filter, setFilter];
}

export function sameFilter(a: LoadFilter, b: LoadFilter): boolean {
  if (a.mode !== b.mode) return false;
  return a.mode !== "weight" || a.weightKg === (b as typeof a).weightKg;
}

/** All · Working · 27.5 · 25 · 20 … — which sets the chart counts. */
export function LoadFilterChips({
  records,
  unit,
  value,
  onChange,
}: {
  records: ExerciseSetRecord[];
  unit: Unit;
  value: LoadFilter;
  onChange: (filter: LoadFilter) => void;
}) {
  const { t } = useI18n();
  const options = useMemo(() => loadOptions(records), [records]);
  const chips: { key: string; label: string; filter: LoadFilter }[] = [
    {
      key: "working",
      label: t("stats.filter.working"),
      filter: { mode: "working" },
    },
    { key: "all", label: t("stats.filter.all"), filter: ALL },
    ...options.map((option) => ({
      key: `w${option.weightKg}`,
      label: `${roundWeight(kgToUnit(option.weightKg, unit))} ${unit}`,
      filter: { mode: "weight" as const, weightKg: option.weightKg },
    })),
  ];

  return (
    <div
      role="group"
      aria-label={t("stats.filter.label")}
      className={cn(styles.filters, "no-scrollbar")}
    >
      {chips.map((chip, index) => (
        <button
          key={chip.key}
          type="button"
          aria-pressed={sameFilter(chip.filter, value)}
          onClick={() => onChange(chip.filter)}
          className={cn(
            styles.filterChip,
            index === 2 && styles.filterChipSeparated,
            sameFilter(chip.filter, value) && styles.filterChipActive,
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

/** One-line description of what the chart counts under a filter. */
export function useFilterCaption(filter: LoadFilter, unit: Unit): string {
  const { t } = useI18n();
  if (filter.mode === "working") return t("stats.filter.workingHint");
  if (filter.mode === "weight") {
    return t("stats.filter.weightHint", {
      weight: `${roundWeight(kgToUnit(filter.weightKg, unit))} ${unit}`,
    });
  }
  return t("stats.filter.allHint");
}
