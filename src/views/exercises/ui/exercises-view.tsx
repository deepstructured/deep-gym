"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useExercises, type Exercise } from "@/entities/exercise";
import { useMuscleGroups } from "@/entities/muscle-group";
import { useProfile } from "@/entities/user";
import { equipmentLabel } from "@/shared/config/workout";
import { formatWeight } from "@/shared/lib/weight";
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

export function ExercisesView() {
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
    <AppShell title="Exercises">
      <div className="mb-4 space-y-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises…"
        />
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          <Chip selected={groupFilter === null} onClick={() => setGroupFilter(null)}>
            All
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
          title="No exercises yet"
          hint="Exercises are created while logging a workout — or will show up here after your first one."
        />
      ) : (
        <div className="space-y-6">
          {visibleGroups.map(({ group, exercises: list }) => (
            <section key={group.id}>
              <h2 className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
                {group.name}
                <span className="font-dot text-faint">{list.length}</span>
              </h2>
              <div className="space-y-2">
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
  const exerciseUnit = exercise.unit ?? unit;
  return (
    <Link
      href={`/exercises/${exercise.id}`}
      className="flex items-center gap-3 rounded-tile border border-line/60 bg-surface px-4 py-3.5 active:bg-raised"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{exercise.name}</p>
        <Tag className="mt-1">{equipmentLabel(exercise.equipment)}</Tag>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] tracking-wide text-faint uppercase">Working</p>
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
          className="text-xl text-lime"
        />
      </div>
      <IconChevronRight size={18} className="shrink-0 text-faint" />
    </Link>
  );
}
