"use client";

import { useMemo } from "react";
import { useI18n } from "@/shared/i18n";
import { formatWeight, unitToKg, type Unit } from "@/shared/lib/weight";
import { Card } from "@/shared/ui";
import { parseWeight, type WorkoutDraft } from "../model/draft";
import styles from "./draft-summary.module.scss";

/**
 * Running totals for the draft, shown in the desktop shell's right rail.
 * Warm-ups are excluded, exactly like every other statistic in the app
 * (see `workingSets` in training-analytics).
 */
export function DraftSummary({
  draft,
  unit,
}: {
  draft: WorkoutDraft;
  unit: Unit;
}) {
  const { t } = useI18n();

  const totals = useMemo(() => {
    let sets = 0;
    let reps = 0;
    let volumeKg = 0;
    for (const exercise of draft.exercises) {
      const exerciseUnit = exercise.unit ?? unit;
      for (const set of exercise.sets) {
        if (set.warmup) continue;
        const weight = parseWeight(set.weight);
        const count = Number(set.reps);
        if (!Number.isFinite(count) || count <= 0) continue;
        sets += 1;
        reps += count;
        if (weight != null) volumeKg += unitToKg(weight, exerciseUnit) * count;
      }
    }
    return { sets, reps, volumeKg, exercises: draft.exercises.length };
  }, [draft, unit]);

  return (
    <Card variant="surface" className={styles.card}>
      <p className={styles.title}>{t("workout.liveSummary")}</p>
      <dl className={styles.rows}>
        <Row label={t("progress.exercises")} value={String(totals.exercises)} />
        <Row label={t("progress.sets")} value={String(totals.sets)} />
        <Row label={t("stats.totalReps")} value={String(totals.reps)} />
        <Row
          label={t("stats.metric.volume")}
          value={formatWeight(totals.volumeKg, unit)}
          strong
        />
      </dl>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={styles.row}>
      <dt className={styles.label}>{label}</dt>
      <dd className={strong ? styles.valueStrong : styles.value}>{value}</dd>
    </div>
  );
}
