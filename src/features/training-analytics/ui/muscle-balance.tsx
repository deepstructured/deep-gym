"use client";

import { useMemo } from "react";
import { useMuscleGroups } from "@/entities/muscle-group";
import type { Workout } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { setsByMuscleGroup } from "../model/analytics";
import styles from "./muscle-balance.module.scss";

interface MuscleBalanceProps {
  workouts: Workout[];
  limit?: number;
  compact?: boolean;
  emptyLabel?: string;
}

/** Working sets per muscle group — spots neglected groups at a glance. */
export function MuscleBalance({
  workouts,
  limit,
  compact = false,
  emptyLabel,
}: MuscleBalanceProps) {
  const { tn } = useI18n();
  const { data: groups } = useMuscleGroups();
  const rows = useMemo(() => {
    const counts = setsByMuscleGroup(workouts);
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    return (groups ?? [])
      .map((group) => ({
        id: group.id,
        name: group.name,
        sets: counts.get(group.id) ?? 0,
        share: total ? (counts.get(group.id) ?? 0) / total : 0,
      }))
      .filter((row) => row.sets > 0)
      .sort((a, b) => b.sets - a.sets);
  }, [groups, workouts]);

  if (rows.length === 0) {
    return emptyLabel ? <p className={styles.empty}>{emptyLabel}</p> : null;
  }
  const max = rows[0].sets;
  const shown = limit != null ? rows.slice(0, limit) : rows;

  return (
    <div className={cn(styles.list, compact && styles.compact)}>
      {shown.map((row, index) => (
        <div key={row.id} className={styles.row}>
          <div className={styles.head}>
            <span className={styles.name}>{row.name}</span>
            <span className={styles.count}>
              {tn("count.sets", row.sets)}
              <em>{Math.round(row.share * 100)}%</em>
            </span>
          </div>
          <div className={styles.track}>
            <span
              className={cn(styles.bar, index === 0 && styles.barTop)}
              style={{ width: `${Math.max((row.sets / max) * 100, 3)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
