"use client";

import {
  useBodyWeightMeasurements,
  type BodyWeightMeasurement,
} from "@/entities/body-weight";
import { useProfile } from "@/entities/user";
import { useI18n } from "@/shared/i18n";
import { kgToUnit, roundWeight } from "@/shared/lib/weight";
import { Card, EmptyState, ErrorNote, PageLoader, Tag } from "@/shared/ui";
import { BodyWeightChart } from "./body-weight-chart";
import styles from "./body-weight.module.scss";

export interface BodyWeightHistoryProps {
  /** Presentational mode for hosts that already own the query. */
  measurements?: BodyWeightMeasurement[];
  queryLimit?: number;
  maxRows?: number;
  className?: string;
}

/** Query-backed by default, but accepts measurements for fully presentational
 * reuse. The table remains newest-first while the chart sorts chronologically. */
export function BodyWeightHistory({
  measurements,
  queryLimit = 90,
  maxRows = 10,
  className,
}: BodyWeightHistoryProps) {
  const { t, lang } = useI18n();
  const { data: profile } = useProfile();
  const query = useBodyWeightMeasurements({
    limit: queryLimit,
    enabled: measurements == null,
  });
  const unit = profile?.unit ?? "kg";
  const rows = measurements ?? query.data ?? [];
  const locale = { en: "en-US", ru: "ru-RU", uk: "uk-UA" }[lang];

  return (
    <Card variant="surface" className={`${styles.history} ${className ?? ""}`}>
      <div className={styles.historyHeading}>
        <p className={styles.title}>{t("bodyWeight.historyTitle")}</p>
        {rows.length > 0 && (
          <span className={styles.historyCount}>
            {t("bodyWeight.entryCount", { count: rows.length })}
          </span>
        )}
      </div>

      {measurements == null && query.isLoading ? (
        <PageLoader />
      ) : measurements == null && query.error ? (
        <ErrorNote message={t("common.error")} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={t("bodyWeight.historyEmpty")}
          hint={t("bodyWeight.historyEmptyHint")}
        />
      ) : (
        <>
          <BodyWeightChart measurements={rows} unit={unit} />
          <div className={styles.historyRows}>
            {rows.slice(0, maxRows).map((measurement) => (
              <div key={measurement.id} className={styles.historyRow}>
                <div>
                  <p className={styles.historyWeight}>
                    {roundWeight(kgToUnit(measurement.weight_kg, unit))}{" "}
                    <span>{unit}</span>
                  </p>
                  <p className={styles.historyDate}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(measurement.measured_at))}
                  </p>
                </div>
                <Tag>{t(`bodyWeight.source.${measurement.source}`)}</Tag>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
