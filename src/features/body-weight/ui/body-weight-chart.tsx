"use client";

import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import type { BodyWeightMeasurement } from "@/entities/body-weight";
import { useI18n } from "@/shared/i18n";
import { formatAxisDate } from "@/shared/lib/dates";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";
import { LineChart } from "@/shared/ui";

export interface BodyWeightChartProps {
  measurements: BodyWeightMeasurement[];
  unit: Unit;
  height?: number;
  /** Tiny axis-less sparkline for widgets. */
  sparkline?: boolean;
  onActiveChange?: (measurement: BodyWeightMeasurement | null) => void;
  className?: string;
}

/** Interactive body-weight line (lime). Input order is irrelevant. */
export function BodyWeightChart({
  measurements,
  unit,
  height = 150,
  sparkline = false,
  onActiveChange,
  className,
}: BodyWeightChartProps) {
  const { t } = useI18n();
  const sorted = useMemo(
    () =>
      [...measurements].sort(
        (a, b) =>
          a.measured_at.localeCompare(b.measured_at) ||
          a.created_at.localeCompare(b.created_at),
      ),
    [measurements],
  );
  if (sorted.length === 0) return null;

  const points = sorted.map((measurement) => ({
    date: measurement.measured_at,
    value: roundWeight(kgToUnit(measurement.weight_kg, unit)),
  }));

  return (
    <LineChart
      points={points}
      height={height}
      tone="lime"
      axes={!sparkline}
      framed={!sparkline}
      interactive={!sparkline}
      showTooltip={!sparkline}
      showDots={sparkline ? false : undefined}
      formatValue={(value) => String(roundWeight(value))}
      formatDate={(date, span) =>
        span === 0
          ? `${formatAxisDate(date)}, ${format(parseISO(date), "HH:mm")}`
          : formatAxisDate(date, span)
      }
      onActiveChange={(index) =>
        onActiveChange?.(index != null ? sorted[index] : null)
      }
      ariaLabel={t("bodyWeight.chartAria", {
        from: points[0].value,
        to: points.at(-1)!.value,
        unit,
      })}
      className={className}
    />
  );
}
