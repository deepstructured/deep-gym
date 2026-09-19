"use client";

import {
  useBodyWeightMeasurements,
  type BodyWeightMeasurement,
} from "@/entities/body-weight";
import { useProfile } from "@/entities/user";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { kgToUnit, roundWeight } from "@/shared/lib/weight";
import { Card, EmptyState, ErrorNote, PageLoader, Tag } from "@/shared/ui";
import { BodyWeightChart } from "./body-weight-chart";
import styles from "./body-weight.module.scss";

export interface BodyWeightHistoryProps {
  /** Presentational mode for hosts that already own the query. */
  measurements?: BodyWeightMeasurement[];
  queryLimit?: number;
  /** Render without the card chrome (e.g. inside a sheet). */
  bare?: boolean;
  className?: string;
}

/** Interactive chart plus a height-capped, scrollable list — however many
 *  entries there are, the block never grows past one screen. */
export function BodyWeightHistory({
  measurements,
  queryLimit = 365,
  bare = false,
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
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const body = (
    <>
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
          <div className={cn(styles.historyRows, "no-scrollbar")}>
            {rows.map((measurement, index) => {
              const value = roundWeight(kgToUnit(measurement.weight_kg, unit));
              const older = rows[index + 1];
              const diff = older
                ? roundWeight(
                    kgToUnit(measurement.weight_kg - older.weight_kg, unit),
                  )
                : 0;
              return (
                <div key={measurement.id} className={styles.historyRow}>
                  <div className={styles.historyMain}>
                    <p className={styles.historyWeight}>
                      {value} <span>{unit}</span>
                      {diff !== 0 && (
                        <em className={diff > 0 ? styles.diffUp : styles.diffDown}>
                          {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}
                        </em>
                      )}
                    </p>
                    <p className={styles.historyDate}>
                      {dateFormat.format(new Date(measurement.measured_at))}
                    </p>
                  </div>
                  <Tag>{t(`bodyWeight.source.${measurement.source}`)}</Tag>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );

  return bare ? (
    <div className={cn(styles.history, className)}>{body}</div>
  ) : (
    <Card variant="surface" className={cn(styles.history, className)}>
      {body}
    </Card>
  );
}
