"use client";

import { useI18n } from "@/shared/i18n";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";
import { DotValue, IconFlame } from "@/shared/ui";
import type { WeightRepStats } from "../model/stats";

interface RepsByWeightTableProps {
  stats: WeightRepStats[];
  unit: Unit;
  /** Show only the heaviest N rows (all rows when omitted). */
  maxRows?: number;
}

/** Weight → sets / avg / median / mode reps, heaviest first. The flame marks
 *  weights that were taken to failure (opacity follows the failure share). */
export function RepsByWeightTable({
  stats,
  unit,
  maxRows,
}: RepsByWeightTableProps) {
  const { t } = useI18n();
  const rows = maxRows != null ? stats.slice(0, maxRows) : stats;
  if (rows.length === 0) return null;

  return (
    <div>
      <div className="mb-1 grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr] px-1 text-[10px] font-medium tracking-wide text-faint uppercase">
        <span>{t("detail.weight")}</span>
        <span className="text-center">{t("detail.sets")}</span>
        <span className="text-center">{t("detail.avg")}</span>
        <span className="text-center">{t("detail.med")}</span>
        <span className="text-center">{t("detail.mode")}</span>
      </div>
      <div className="divide-y divide-line/50">
        {rows.map((row) => (
          <div
            key={row.weightKg}
            className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr] items-center px-1 py-2.5"
          >
            <span className="flex items-center gap-1.5">
              <DotValue
                value={roundWeight(kgToUnit(row.weightKg, unit))}
                className="text-lg"
              />
              {row.failureRate > 0 && (
                <IconFlame
                  size={13}
                  className="text-flame"
                  opacity={0.4 + row.failureRate * 0.6}
                />
              )}
            </span>
            <span className="text-center font-dot text-muted">
              {row.setCount}
            </span>
            <span className="text-center font-dot">{row.avgReps}</span>
            <span className="text-center font-dot">{row.medianReps}</span>
            <span className="text-center font-dot">{row.modeReps}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
