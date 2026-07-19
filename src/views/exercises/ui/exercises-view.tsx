"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useExercises, type Exercise } from "@/entities/exercise";
import { useMuscleGroups } from "@/entities/muscle-group";
import { useProfile } from "@/entities/user";
import { useI18n } from "@/shared/i18n";
import { formatWeight } from "@/shared/lib/weight";
import { cn } from "@/shared/lib/cn";
import { AppShell } from "@/widgets/app-shell";
import {
  Chip,
  DotValue,
  EmptyState,
  IconChevronRight,
  Input,
  PageLoader,
  Tag,
} from "@/shared/ui";
import styles from "./exercises-view.module.scss";

export function ExercisesView() {
  const { t } = useI18n();
  const { data: groups, isLoading: groupsLoading } = useMuscleGroups();
  const { data: exercises, isLoading } = useExercises();
  const { data: profile } = useProfile();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);

  const unit = profile?.unit ?? "kg";

  const filtered = useMemo(() => {
    let list = exercises ?? [];
    if (groupFilter) list = list.filter((e) => e.muscle_group_id === groupFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));
    return list;
  }, [exercises, groupFilter, search]);

  const visibleGroups = useMemo(() => {
    if (!groups) return [];
    return groups
      .filter((g) => (groupFilter ? g.id === groupFilter : true))
      .map((group) => ({
        group,
        exercises: filtered.filter((e) => e.muscle_group_id === group.id),
      }))
      .filter((section) => section.exercises.length > 0);
  }, [groups, filtered, groupFilter]);

  return (
    <AppShell title={t("exercises.title")}>
      <div className={styles.filters}>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("picker.search")}
        />
        <div className={cn(styles.groupRow, "no-scrollbar")}>
          <Chip selected={groupFilter === null} onClick={() => setGroupFilter(null)}>
            {t("common.all")}
          </Chip>
          {groups?.map((group) => (
            <Chip
              key={group.id}
              selected={groupFilter === group.id}
              onClick={() =>
                setGroupFilter(groupFilter === group.id ? null : group.id)
              }
            >
              {group.name}
            </Chip>
          ))}
        </div>
      </div>

      {isLoading || groupsLoading ? (
        <PageLoader />
      ) : visibleGroups.length === 0 ? (
        <EmptyState
          title={t("exercises.emptyTitle")}
          hint={t("exercises.emptyHint")}
        />
      ) : (
        <div className={styles.sections}>
          {visibleGroups.map(({ group, exercises: list }) => (
            <section key={group.id}>
              <h2 className={styles.sectionTitle}>
                {group.name}
                <span className={styles.sectionCount}>{list.length}</span>
              </h2>
              <div className={styles.list}>
                {list.map((exercise) => (
                  <ExerciseRow key={exercise.id} exercise={exercise} unit={unit} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function ExerciseRow({
  exercise,
  unit,
}: {
  exercise: Exercise;
  unit: "kg" | "lb";
}) {
  const { t } = useI18n();
  const exerciseUnit = exercise.unit ?? unit;
  return (
    <Link
      href={`/exercises/${exercise.id}`}
      className={cn(styles.row, "surface-well")}
    >
      <div className={styles.rowText}>
        <p className={styles.rowName}>{exercise.name}</p>
        <Tag className={styles.rowTag}>{t(`equipment.${exercise.equipment}`)}</Tag>
      </div>
      <div className={styles.rowWeight}>
        <p className={styles.rowWeightLabel}>{t("exercises.working")}</p>
        <DotValue
          value={
            exercise.working_weight_kg != null
              ? formatWeight(exercise.working_weight_kg, exerciseUnit).replace(
                  ` ${exerciseUnit}`,
                  "",
                )
              : "—"
          }
          suffix={
            exercise.working_weight_kg != null ? exerciseUnit : undefined
          }
          className={styles.rowWeightValue}
        />
      </div>
      <IconChevronRight size={18} className={styles.rowChevron} />
    </Link>
  );
}
