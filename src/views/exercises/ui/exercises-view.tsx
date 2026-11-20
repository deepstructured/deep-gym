"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ExerciseCreateForm,
  useExercises,
  type Exercise,
} from "@/entities/exercise";
import { filterExercisesByGym } from "@deepgym/core/gym-data";
import { GymSelect, useGymPreference, useGyms } from "@/entities/gym";
import { useMuscleGroups } from "@/entities/muscle-group";
import { useProfile } from "@/entities/user";
import { useI18n } from "@/shared/i18n";
import { formatWeight } from "@/shared/lib/weight";
import { cn } from "@/shared/lib/cn";
import { AppShell, LibraryTabs } from "@/widgets/app-shell";
import {
  Button,
  Chip,
  DotValue,
  ErrorNote,
  EmptyState,
  IconChevronRight,
  IconPlus,
  Input,
  PageLoader,
  Sheet,
  Tag,
} from "@/shared/ui";
import styles from "./exercises-view.module.scss";

export function ExercisesView() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: groups, isLoading: groupsLoading } = useMuscleGroups();
  const { data: exercises, isLoading } = useExercises();
  const { data: profile } = useProfile();
  const { data: gyms, isError: gymsError } = useGyms();
  const { filter: gymFilter, rememberFilter, gymId: lastGym, isError: preferenceError } = useGymPreference();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const unit = profile?.unit ?? "kg";
  const gymId = gymFilter && gymFilter !== "none" ? gymFilter : null;

  const catalog = useMemo(
    () => filterExercisesByGym(exercises ?? [], gyms ?? [], gymFilter),
    [exercises, gyms, gymFilter],
  );

  const filtered = useMemo(() => {
    let list = catalog;
    if (groupFilter) list = list.filter((e) => e.muscle_group_id === groupFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));
    return list;
  }, [catalog, groupFilter, search]);

  const countByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const exercise of catalog) {
      counts.set(
        exercise.muscle_group_id,
        (counts.get(exercise.muscle_group_id) ?? 0) + 1,
      );
    }
    return counts;
  }, [catalog]);

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
    <AppShell
      title={t("nav.library")}
      account
      subheader={<LibraryTabs />}
      action={
        <Button
          type="button"
          variant="lime"
          size="sm"
          iconOnly
          aria-label={t("picker.createNew")}
          onClick={() => setCreateOpen(true)}
        >
          <IconPlus size={18} />
        </Button>
      }
    >
      {/* Phone: filters above the list. Desktop: CSS turns the filters into
          a sticky left rail and the list into a multi-column grid. */}
      <div className={styles.layout}>
        <div className={styles.filters}>
          {(Boolean(gyms?.length) || Boolean(gymFilter)) && <GymSelect gyms={gyms ?? []} value={gymFilter} filter onChange={rememberFilter} />}
          {preferenceError && <ErrorNote message={t("gym.preferenceError")} />}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("picker.search")}
          />
          <div className={cn(styles.groupRow, "no-scrollbar")}>
            <Chip
              selected={groupFilter === null}
              className={styles.groupChip}
              onClick={() => setGroupFilter(null)}
            >
              {t("common.all")}
              <span className={styles.groupCount}>
                {exercises ? catalog.length : ""}
              </span>
            </Chip>
            {groups?.map((group) => (
              <Chip
                key={group.id}
                selected={groupFilter === group.id}
                className={styles.groupChip}
                onClick={() =>
                  setGroupFilter(groupFilter === group.id ? null : group.id)
                }
              >
                {group.name}
                <span className={styles.groupCount}>
                  {countByGroup.get(group.id) ?? 0}
                </span>
              </Chip>
            ))}
          </div>
        </div>

        <div className={styles.results}>
          {isLoading || groupsLoading ? (
            <PageLoader variant="cards" />
          ) : visibleGroups.length === 0 ? (
            <EmptyState
              title={t("exercises.emptyTitle")}
              hint={t(gymFilter && gymFilter !== "none" && !catalog.length ? "gym.notAssigned" : "exercises.emptyHint")}
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
                      <ExerciseRow
                        key={exercise.id}
                        exercise={exercise}
                        href={exerciseHref(exercise.id, gymId)}
                        unit={unit}
                        bodyWeightKg={profile?.body_weight_kg ?? null}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
      <Sheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("picker.newTitle")}
      >
        <ExerciseCreateForm
          key={createOpen ? "open" : "closed"}
          groups={groups ?? []}
          gyms={gyms ?? (gymsError ? null : undefined)}
          unit={unit}
          defaultGroupId={groupFilter}
          defaultGymId={gymId ?? lastGym}
          submitLabel={t("picker.createNew")}
          onCreated={(exercise) => {
            setCreateOpen(false);
            router.push(exerciseHref(exercise.id, gymId));
          }}
        />
      </Sheet>
    </AppShell>
  );
}

function exerciseHref(id: string, gymId: string | null) {
  return gymId ? `/exercises/${id}?gym=${encodeURIComponent(gymId)}` : `/exercises/${id}`;
}

function ExerciseRow({
  exercise,
  href,
  unit,
  bodyWeightKg,
}: {
  exercise: Exercise;
  href: string;
  unit: "kg" | "lb";
  bodyWeightKg: number | null;
}) {
  const { t } = useI18n();
  const exerciseUnit = exercise.unit ?? unit;
  const shownWeightKg =
    exercise.equipment === "bodyweight"
      ? bodyWeightKg
      : exercise.working_weight_kg;
  return (
    <Link
      href={href}
      className={cn(styles.row, "surface-well")}
    >
      <div className={styles.rowText}>
        <p className={styles.rowName}>{exercise.name}</p>
        <Tag className={styles.rowTag}>{t(`equipment.${exercise.equipment}`)}</Tag>
      </div>
      <div className={styles.rowWeight}>
        <p className={styles.rowWeightLabel}>
          {exercise.equipment === "bodyweight"
            ? t("bodyWeight.title")
            : t("exercises.working")}
        </p>
        <DotValue
          value={
            shownWeightKg != null
              ? formatWeight(shownWeightKg, exerciseUnit).replace(
                  ` ${exerciseUnit}`,
                  "",
                )
              : "—"
          }
          suffix={shownWeightKg != null ? exerciseUnit : undefined}
          className={styles.rowWeightValue}
        />
      </div>
      <IconChevronRight size={18} className={styles.rowChevron} />
    </Link>
  );
}
