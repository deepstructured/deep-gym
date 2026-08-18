"use client";

import { useMemo, useState } from "react";
import {
  ExerciseCreateForm,
  useExercises,
  type Exercise,
} from "@/entities/exercise";
import { useMuscleGroups } from "@/entities/muscle-group";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import type { Unit } from "@/shared/lib/weight";
import {
  Button,
  Chip,
  IconPlus,
  Input,
  PageLoader,
  Sheet,
} from "@/shared/ui";
import styles from "./exercise-picker.module.scss";

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise, muscleGroupName: string) => void;
  unit: Unit;
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
  unit,
}: ExercisePickerProps) {
  const { t } = useI18n();
  const { data: groups, isLoading: groupsLoading } = useMuscleGroups();
  const { data: exercises, isLoading } = useExercises();

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const groupName = (id: string) =>
    groups?.find((g) => g.id === id)?.name ?? "";

  const filtered = useMemo(() => {
    let list = exercises ?? [];
    if (groupFilter) list = list.filter((e) => e.muscle_group_id === groupFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));
    return list;
  }, [exercises, groupFilter, search]);

  function resetCreateForm() {
    setCreating(false);
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        resetCreateForm();
        onClose();
      }}
      title={creating ? t("picker.newTitle") : t("picker.title")}
      className={styles.sheet}
    >
      {creating ? (
        <ExerciseCreateForm
          key={groupFilter ?? "all"}
          groups={groups ?? []}
          unit={unit}
          defaultGroupId={groupFilter}
          submitLabel={t("picker.createAdd")}
          onCancel={resetCreateForm}
          onCreated={(exercise, muscleGroupName) => {
            resetCreateForm();
            onPick(exercise, muscleGroupName);
          }}
        />
      ) : (
        <div className={styles.stack}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("picker.search")}
          />

          <div className={cn(styles.filterRow, "no-scrollbar")}>
            <Chip selected={groupFilter === null} onClick={() => setGroupFilter(null)}>
              {t("common.all")}
            </Chip>
            {groups?.map((group) => (
              <Chip
                key={group.id}
                selected={groupFilter === group.id}
                onClick={() => setGroupFilter(group.id)}
              >
                {group.name}
              </Chip>
            ))}
          </div>

          {isLoading || groupsLoading ? (
            <PageLoader />
          ) : (
            <div className={styles.list}>
              {filtered.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() =>
                    onPick(exercise, groupName(exercise.muscle_group_id))
                  }
                  className={styles.item}
                >
                  <span>
                    <span className={styles.itemName}>{exercise.name}</span>
                    <span className={styles.itemMeta}>
                      {groupName(exercise.muscle_group_id)} ·{" "}
                      {t(`equipment.${exercise.equipment}`)}
                    </span>
                  </span>
                  <IconPlus size={18} className={styles.itemPlus} />
                </button>
              ))}
              {filtered.length === 0 && (
                <p className={styles.emptyNote}>
                  {search.trim()
                    ? t("picker.emptyFor", { query: search.trim() })
                    : t("picker.empty")}
                </p>
              )}
            </div>
          )}

          <Button
            variant="surface"
            block
            dashed
            disabled={groupsLoading || !groups?.length}
            onClick={() => {
              setCreating(true);
            }}
          >
            <IconPlus size={18} />
            {t("picker.createNew")}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
