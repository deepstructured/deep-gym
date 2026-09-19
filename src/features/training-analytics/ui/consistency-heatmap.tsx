"use client";

import { addDays, format, startOfWeek } from "date-fns";
import { useMemo } from "react";
import type { Workout } from "@/entities/workout";
import { cn } from "@/shared/lib/cn";
import { getDateLocale, toISODate, todayISO } from "@/shared/lib/dates";
import { activityByDate } from "../model/analytics";
import styles from "./consistency-heatmap.module.scss";

interface ConsistencyHeatmapProps {
  workouts: Workout[];
  weeks?: number;
}

/** GitHub-style grid: one column per week, one cell per weekday. */
export function ConsistencyHeatmap({
  workouts,
  weeks = 16,
}: ConsistencyHeatmapProps) {
  const today = todayISO();
  const { columns, monthLabels } = useMemo(() => {
    const activity = activityByDate(workouts);
    const firstMonday = addDays(
      startOfWeek(new Date(), { weekStartsOn: 1 }),
      -(weeks - 1) * 7,
    );
    const cols = Array.from({ length: weeks }, (_, week) =>
      Array.from({ length: 7 }, (_, day) => {
        const date = toISODate(addDays(firstMonday, week * 7 + day));
        return { date, count: activity.get(date) ?? 0 };
      }),
    );
    // Month label above the first column of each month.
    const labels = cols.map((column, index) => {
      const month = column[0].date.slice(0, 7);
      const previous = index > 0 ? cols[index - 1][0].date.slice(0, 7) : null;
      return month !== previous
        ? format(addDays(firstMonday, index * 7), "LLL", {
            locale: getDateLocale(),
          })
        : "";
    });
    return { columns: cols, monthLabels: labels };
  }, [workouts, weeks]);

  return (
    <div className={styles.wrap}>
      <div
        className={styles.months}
        style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}
      >
        {monthLabels.map((label, index) => (
          <span key={index} className={styles.month}>
            {label}
          </span>
        ))}
      </div>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}
        role="img"
      >
        {columns.map((column, week) => (
          <div key={week} className={styles.column}>
            {column.map((cell) => (
              <span
                key={cell.date}
                title={cell.date}
                className={cn(
                  styles.cell,
                  cell.count === 1 && styles.level1,
                  cell.count > 1 && styles.level2,
                  cell.date === today && styles.today,
                  cell.date > today && styles.future,
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
