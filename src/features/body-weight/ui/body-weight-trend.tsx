"use client";

import { useState } from "react";
import {
  useBodyWeightMeasurements,
  type BodyWeightMeasurement,
} from "@/entities/body-weight";
import { useProfile } from "@/entities/user";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatDay, fromISODate } from "@/shared/lib/dates";
import { periodStart, type PeriodKey } from "@/shared/lib/period";
import { kgToUnit, roundWeight } from "@/shared/lib/weight";
import { DotValue } from "@/shared/ui";
import { BodyWeightChart } from "./body-weight-chart";
import styles from "./body-weight-trend.module.scss";

interface BodyWeightTrendProps {
  period: PeriodKey;
  height?: number;
  /** Header-less sparkline variant for widgets. */
  compact?: boolean;
  emptyLabel?: string;
}

/** Current weight, change over the period and the interactive line. */
export function BodyWeightTrend({
  period,
  height = 150,
  compact = false,
  emptyLabel,
}: BodyWeightTrendProps) {
  const { t } = useI18n();
  const { data: profile } = useProfile();
  const unit = profile?.unit ?? "kg";
  const from = periodStart(period);
  const { data } = useBodyWeightMeasurements({
    from: from ? fromISODate(from).toISOString() : undefined,
    limit: 1000,
  });
  const [active, setActive] = useState<BodyWeightMeasurement | null>(null);

  const rows = data ?? [];
  const newest = rows[0];
  const oldest = rows.at(-1);
  const shown = active ?? newest;
  const change =
    newest && oldest && rows.length > 1
      ? roundWeight(kgToUnit(newest.weight_kg - oldest.weight_kg, unit))
      : null;

  if (rows.length === 0) {
    return emptyLabel ? <p className={styles.empty}>{emptyLabel}</p> : null;
  }

  return (
    <div className={cn(styles.wrap, compact && styles.compact)}>
      <div className={styles.readout}>
        <div>
          <DotValue
            value={roundWeight(kgToUnit(shown.weight_kg, unit))}
            suffix={unit}
            className={cn(styles.value, compact && styles.valueCompact)}
            suffixClassName={styles.suffix}
          />
          {!compact && (
            <p className={styles.meta}>
              {formatDay(shown.measured_at.slice(0, 10))}
            </p>
          )}
        </div>
        {change != null && !active && (
          <p className={styles.change}>
            <span className={styles.changeValue}>
              {change > 0 ? "+" : change < 0 ? "−" : ""}
              {Math.abs(change)} {unit}
            </span>
            <span className={styles.changeLabel}>
              {t(`period.over.${period}`)}
            </span>
          </p>
        )}
      </div>
      <BodyWeightChart
        measurements={rows}
        unit={unit}
        height={height}
        sparkline={compact}
        onActiveChange={setActive}
      />
    </div>
  );
}
