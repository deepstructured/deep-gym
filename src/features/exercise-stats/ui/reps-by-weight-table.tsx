"use client";

import { useI18n } from "@/shared/i18n";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";
import { DotValue, IconFlame } from "@/shared/ui";
import type { WeightRepStats } from "../model/stats";
import styles from "./reps-by-weight-table.module.scss";

interface RepsByWeightTableProps {
  stats: WeightRepStats[];
  unit: Unit;
  /** Override the first column for alternate load semantics such as signed
   * added load on body-weight exercises. */
  loadLabel?: string;
  signedLoad?: boolean;
  /** Show only the heaviest N rows (all rows when omitted). */
  maxRows?: number;
}

/** Weight → sets / avg / median / mode reps, heaviest first. The flame marks
 *  weights that were taken to failure (opacity follows the failure share). */
export function RepsByWeightTable({
  stats,
  unit,
  loadLabel,
  signedLoad = false,
  maxRows,
}: RepsByWeightTableProps) {
  const { t } = useI18n();
  const rows = maxRows != null ? stats.slice(0, maxRows) : stats;
  if (rows.length === 0) return null;

  return (
    <div>
      <div className={styles.head}>
        <span>{loadLabel ?? t("detail.weight")}</span>
        <span className={styles.center}>{t("detail.sets")}</span>
        <span className={styles.center}>{t("detail.avg")}</span>
        <span className={styles.center}>{t("detail.med")}</span>
        <span className={styles.center}>{t("detail.mode")}</span>
      </div>
      <div className={styles.rows}>
        {rows.map((row) => (
          <div
            key={row.weightKg}
            className={styles.row}
          >
            <span className={styles.weightCell}>
              <DotValue
                value={formatLoad(row.weightKg, unit, signedLoad)}
                className={styles.weightValue}
              />
              {row.failureRate > 0 && (
                <IconFlame
                  size={13}
                  className={styles.flame}
                  opacity={0.4 + row.failureRate * 0.6}
                />
              )}
            </span>
            <span className={styles.cellMuted}>{row.setCount}</span>
            <span className={styles.cell}>{row.avgReps}</span>
            <span className={styles.cell}>{row.medianReps}</span>
            <span className={styles.cell}>{row.modeReps}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatLoad(weightKg: number, unit: Unit, signed: boolean) {
  const value = roundWeight(kgToUnit(weightKg, unit));
  return signed && value > 0 ? `+${value}` : value;
}
