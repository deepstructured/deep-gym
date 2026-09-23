"use client";

import { useMemo, useState } from "react";
import {
  formatWeeklyActivityAxis,
  formatWeeklyActivityRange,
  formatWeeklyActivityValue,
  weeklyActivityValue,
  type WeeklyActivityMetric,
} from "@deepgym/core/weekly-activity";
import type { Workout } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { kgToUnit, type Unit } from "@/shared/lib/weight";
import { BarChart, Segmented } from "@/shared/ui";
import { weeklyBuckets } from "../model/analytics";
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
  const { t, lang } = useI18n();
  const [ownMetric, setOwnMetric] = useState<WeeklyMetric>("workouts");
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const metric = fixedMetric ?? ownMetric;
  const coreMetric: WeeklyActivityMetric = metric === "volume" ? "volumeKg" : metric;
  const buckets = useMemo(
    () => weeklyBuckets(workouts, weeks),
    [workouts, weeks],
  );

  const selectedIndex = Math.max(0, buckets.findIndex((bucket) => bucket.start === selectedWeekStart));
  const activeIndex = selectedWeekStart && buckets[selectedIndex]?.start === selectedWeekStart
    ? selectedIndex
    : buckets.length - 1;
  const selectedBucket = buckets[activeIndex];
  const bars = buckets.map((bucket) => ({
    key: bucket.start,
    label: "",
    title: formatWeeklyActivityRange(bucket.start, lang),
    ariaLabel: `${formatWeeklyActivityRange(bucket.start, lang)}: ${formatWeeklyActivityValue(bucket, coreMetric, unit, lang)}`,
    value: coreMetric === "volumeKg"
      ? kgToUnit(weeklyActivityValue(bucket, coreMetric), unit)
      : weeklyActivityValue(bucket, coreMetric),
  }));
  const first = buckets[0];
  const middle = buckets[Math.floor((buckets.length - 1) / 2)];
  const last = buckets[buckets.length - 1];

  return (
    <div className={`${styles.wrap} ${fixedMetric ? styles.compact : ""}`}>
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
      {!fixedMetric && selectedBucket && (
        <div className={styles.selection} aria-live="polite">
          <strong className={styles.selectedValue}>
            {formatWeeklyActivityValue(selectedBucket, coreMetric, unit, lang)}
          </strong>
          <span className={styles.selectedRange}>
            {activeIndex === buckets.length - 1 && <span className={styles.currentWeek}>{t("progress.currentWeek")} · </span>}
            {formatWeeklyActivityRange(selectedBucket.start, lang)}
          </span>
        </div>
      )}
      {fixedMetric && selectedBucket && (
        <span className={styles.compactRange}>{formatWeeklyActivityRange(selectedBucket.start, lang)}</span>
      )}
      <BarChart
        bars={bars}
        height={height}
        highlightIndex={bars.length - 1}
        selectedIndex={activeIndex}
        showPill={false}
        showAxisLabels={false}
        onActiveChange={(index) => {
          if (index != null && buckets[index]) setSelectedWeekStart(buckets[index].start);
        }}
        ariaLabel={selectedBucket ? `${t("progress.activity")}: ${formatWeeklyActivityValue(selectedBucket, coreMetric, unit, lang)}, ${formatWeeklyActivityRange(selectedBucket.start, lang)}` : t("progress.activity")}
        formatValue={(value) => String(value)}
      />
      {first && last && <div className={styles.axis} aria-hidden="true">
        <span>{formatWeeklyActivityAxis(first.start, lang)}</span>
        {buckets.length > 2 && <span>{formatWeeklyActivityAxis(middle.start, lang)}</span>}
        <span>{formatWeeklyActivityAxis(last.start, lang)}</span>
      </div>}
      {!fixedMetric && <p className={styles.hint}>{t("progress.weeklyHint")}</p>}
    </div>
  );
}
