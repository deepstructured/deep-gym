"use client";

import { useI18n, type MessageKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import {
  IconChart,
  IconFilter,
  IconFlame,
  IconTrophy,
  Sheet,
} from "@/shared/ui";
import type { ProgressMetric } from "../model/stats";
import styles from "./metric-info-sheet.module.scss";

const METRICS: {
  metric: ProgressMetric;
  title: MessageKey;
  body: MessageKey;
  example?: MessageKey;
}[] = [
  { metric: "topSet", title: "stats.weight", body: "stats.info.topSet" },
  {
    metric: "oneRm",
    title: "stats.oneRmLong",
    body: "stats.info.oneRm",
    example: "stats.info.oneRmExample",
  },
  { metric: "volume", title: "stats.volume", body: "stats.info.volume" },
  { metric: "reps", title: "stats.reps", body: "stats.info.reps" },
  { metric: "addedLoad", title: "stats.addedLoad", body: "stats.info.addedLoad" },
];

interface MetricInfoSheetProps {
  open: boolean;
  onClose: () => void;
  /** Highlights the metric currently on screen. */
  active?: ProgressMetric;
  /** Metrics relevant to the exercise (others are hidden). */
  metrics?: ProgressMetric[];
}

/** Plain-language glossary for the progress metrics and chart controls. */
export function MetricInfoSheet({
  open,
  onClose,
  active,
  metrics,
}: MetricInfoSheetProps) {
  const { t } = useI18n();
  const shown = metrics
    ? METRICS.filter((item) => metrics.includes(item.metric))
    : METRICS;

  return (
    <Sheet open={open} onClose={onClose} title={t("stats.info.title")}>
      <div className={styles.stack}>
        {shown.map((item) => (
          <div
            key={item.metric}
            className={cn(styles.item, item.metric === active && styles.active)}
          >
            <p className={styles.itemTitle}>{t(item.title)}</p>
            <p className={styles.itemBody}>{t(item.body)}</p>
            {item.example && (
              <p className={styles.example}>{t(item.example)}</p>
            )}
          </div>
        ))}

        <div className={styles.tips}>
          <p className={styles.tip}>
            <IconChart size={16} className={styles.tipIcon} />
            {t("stats.info.chart")}
          </p>
          <p className={styles.tip}>
            <IconFilter size={16} className={styles.tipIcon} />
            {t("stats.info.filters")}
          </p>
          <p className={styles.tip}>
            <IconTrophy size={16} className={styles.tipIcon} />
            {t("stats.info.records")}
          </p>
          <p className={styles.tip}>
            <IconFlame size={16} className={styles.tipIcon} />
            {t("stats.info.warmup")}
          </p>
        </div>
      </div>
    </Sheet>
  );
}
