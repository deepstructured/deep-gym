"use client";

import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatShort } from "@/shared/lib/dates";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";
import { IconTrophy } from "@/shared/ui";
import type { PersonalRecord } from "../model/analytics";
import styles from "./records-list.module.scss";

interface RecordsListProps {
  records: PersonalRecord[];
  /** Profile unit; per-exercise overrides still win. */
  unit: Unit;
  limit?: number;
  compact?: boolean;
  /** Rows link to the exercise page unless the host is itself a link. */
  linked?: boolean;
  emptyLabel?: string;
}

/** Recent personal records, newest first, with the gain over the old best. */
export function RecordsList({
  records,
  unit,
  limit = 5,
  compact = false,
  linked = true,
  emptyLabel,
}: RecordsListProps) {
  const { t } = useI18n();
  const rows = records.slice(0, limit);

  if (rows.length === 0) {
    return emptyLabel ? <p className={styles.empty}>{emptyLabel}</p> : null;
  }

  return (
    <div className={cn(styles.list, compact && styles.compact)}>
      {rows.map((record) => {
        const exerciseUnit = record.exerciseUnit ?? unit;
        const isReps = record.kind === "reps";
        const value = isReps
          ? record.value
          : roundWeight(kgToUnit(record.value, exerciseUnit));
        const gain = isReps
          ? record.value - record.previous
          : roundWeight(kgToUnit(record.value - record.previous, exerciseUnit));
        const content = (
          <>
            <span className={styles.icon}>
              <IconTrophy size={compact ? 13 : 15} />
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{record.exerciseName}</span>
              <span className={styles.meta}>
                {t(`progress.record.${record.kind}`)} ·{" "}
                {formatShort(record.date)}
              </span>
            </span>
            <span className={styles.value}>
              <span>
                {value}
                <small>
                  {isReps ? ` ${t("progress.repsShort")}` : ` ${exerciseUnit}`}
                </small>
              </span>
              <em>+{gain}</em>
            </span>
          </>
        );
        const key = `${record.exerciseId}-${record.date}-${record.kind}`;
        return linked ? (
          <Link
            key={key}
            href={`/exercises/${record.exerciseId}`}
            className={styles.row}
          >
            {content}
          </Link>
        ) : (
          <div key={key} className={styles.row}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
