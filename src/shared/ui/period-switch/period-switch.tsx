"use client";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { PERIOD_KEYS, type PeriodKey } from "@/shared/lib/period";
import styles from "./period-switch.module.scss";

interface PeriodSwitchProps {
  value: PeriodKey;
  onChange: (period: PeriodKey) => void;
  className?: string;
}

/** 1M · 3M · 6M · 1Y · All — the look-back window of a chart. */
export function PeriodSwitch({ value, onChange, className }: PeriodSwitchProps) {
  const { t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("period.label")}
      className={cn(styles.group, className)}
    >
      {PERIOD_KEYS.map((period) => (
        <button
          key={period}
          type="button"
          aria-pressed={period === value}
          onClick={() => onChange(period)}
          className={cn(styles.option, period === value && styles.active)}
        >
          {t(`period.${period}`)}
        </button>
      ))}
    </div>
  );
}
