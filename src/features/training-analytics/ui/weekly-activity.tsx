"use client";

import { useMemo, useState } from "react";
import type { Workout } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { formatShort } from "@/shared/lib/dates";
import { kgToUnit, type Unit } from "@/shared/lib/weight";
import { BarChart, Segmented } from "@/shared/ui";
import { weeklyBuckets } from "../model/analytics";
import { formatCompact } from "../model/format";
import styles from "./weekly-activity.module.scss";

type WeeklyMetric = "workouts" | "sets" | "volume";

interface WeeklyActivityProps {
  workouts: Workout[];
  unit: Unit;
  weeks?: number;
  height?: number;
  /** Fixed metric without the switcher (compact widgets). */
  metric?: WeeklyMetric;
}

/** Column per calendar week — workouts, working sets or volume. */
export function WeeklyActivity({
  workouts,
  unit,
  weeks = 12,
  height = 140,
  metric: fixedMetric,
}: WeeklyActivityProps) {
  const { t } = useI18n();
  const [ownMetric, setOwnMetric] = useState<WeeklyMetric>("workouts");
  const metric = fixedMetric ?? ownMetric;
  const buckets = useMemo(
    () => weeklyBuckets(workouts, weeks),
    [workouts, weeks],
  );

  const bars = buckets.map((bucket) => ({
    key: bucket.start,
    label: formatShort(bucket.start),
    title: t("progress.weekOf", { date: formatShort(bucket.start) }),
    value:
      metric === "workouts"
        ? bucket.workouts
        : metric === "sets"
          ? bucket.sets
          : kgToUnit(bucket.volumeKg, unit),
  }));

  return (
    <div className={styles.wrap}>
      {!fixedMetric && (
        <Segmented
          value={metric}
          onChange={setOwnMetric}
          options={[
            { value: "workouts", label: t("progress.workouts") },
            { value: "sets", label: t("progress.sets") },
            { value: "volume", label: t("stats.volume") },
          ]}
          className={styles.switch}
        />
      )}
      <BarChart
        bars={bars}
        height={height}
        highlightIndex={bars.length - 1}
        labelEvery={weeks > 8 ? 4 : 2}
        formatValue={(value) =>
          metric === "volume"
            ? `${formatCompact(value)} ${unit}`
            : String(Math.round(value))
        }
      />
    </div>
  );
}
