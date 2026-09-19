"use client";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { kgToUnit, type Unit } from "@/shared/lib/weight";
import { DotValue } from "@/shared/ui";
import { percentChange, type PeriodTotals } from "../model/analytics";
import { formatCompact } from "../model/format";
import styles from "./period-overview.module.scss";

interface PeriodOverviewProps {
  current: PeriodTotals;
  /** The equally long window before; null for all time. */
  previous: PeriodTotals | null;
  unit: Unit;
}

/** Percent change, or null without a non-zero previous value. */
function change(current: number, previous: number | undefined) {
  return previous ? percentChange(current, previous) : null;
}

/** Four headline tiles for a period, each with its change vs the previous
 *  window of the same length. */
export function PeriodOverview({
  current,
  previous,
  unit,
}: PeriodOverviewProps) {
  const { t } = useI18n();
  const tiles = [
    {
      label: t("progress.workouts"),
      value: String(current.workouts),
      delta: change(current.workouts, previous?.workouts),
    },
    {
      label: t("progress.sets"),
      value: String(current.sets),
      delta: change(current.sets, previous?.sets),
    },
    {
      label: t("stats.volume"),
      value: formatCompact(kgToUnit(current.volumeKg, unit)),
      suffix: unit,
      delta: change(current.volumeKg, previous?.volumeKg),
    },
    {
      label: t("stats.perWeekShort"),
      value: String(current.perWeek),
      suffix: "×",
      delta: change(current.perWeek, previous?.perWeek),
    },
  ];

  return (
    <div className={styles.grid}>
      {tiles.map((tile) => (
        <div key={tile.label} className={cn(styles.tile, "stat-well")}>
          <p className={styles.label}>{tile.label}</p>
          <DotValue
            value={tile.value}
            suffix={tile.suffix}
            className={styles.value}
            suffixClassName={styles.suffix}
          />
          {tile.delta != null && Number.isFinite(tile.delta) && (
            <p
              className={cn(
                styles.delta,
                tile.delta > 0.5 && styles.up,
                tile.delta < -0.5 && styles.down,
              )}
            >
              {tile.delta > 0.5 ? "▲" : tile.delta < -0.5 ? "▼" : "•"}{" "}
              {Math.abs(Math.round(tile.delta))}%
              <span className={styles.deltaLabel}>
                {" "}
                {t("progress.vsPrevious")}
              </span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
