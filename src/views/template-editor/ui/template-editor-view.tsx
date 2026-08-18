"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useExercises, type Exercise } from "@/entities/exercise";
import {
  useMuscleGroups,
  type MuscleGroup,
} from "@/entities/muscle-group";
import {
  useCreateWorkoutTemplate,
  useUpdateWorkoutTemplate,
  useWorkoutTemplate,
} from "@/entities/workout-template";
import { BASE_WORKOUT_TYPES } from "@/shared/config/workout";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { AppShell } from "@/widgets/app-shell";
import {
  Button,
  Chip,
  ErrorNote,
  Field,
  IconChevronDown,
  IconPlus,
  IconTrash,
  Input,
  PageLoader,
  Sheet,
} from "@/shared/ui";
import styles from "./template-editor-view.module.scss";

interface TemplateEditorViewProps {
  templateId?: string;
}

export function TemplateEditorView({ templateId }: TemplateEditorViewProps) {
  const router = useRouter();
  const { t } = useI18n();
  const editing = Boolean(templateId);
  const {
    data: template,
    isLoading: templateLoading,
    error: templateError,
  } = useWorkoutTemplate(templateId ?? "");
  const {
    data: exercises,
    isLoading: exercisesLoading,
    error: exercisesError,
  } = useExercises();
  const {
    data: groups,
    isLoading: groupsLoading,
    error: groupsError,
  } = useMuscleGroups();
  const createTemplate = useCreateWorkoutTemplate();
  const updateTemplate = useUpdateWorkoutTemplate();

  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("Full Body");
  const [exerciseIds, setExerciseIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId || !template || loadedTemplateId === templateId) return;
    setName(template.name);
    setType(template.type);
    setExerciseIds(
      template.workout_template_exercises.map((item) => item.exercise_id),
    );
    setLoadedTemplateId(templateId);
  }, [loadedTemplateId, template, templateId]);

  const exerciseById = useMemo(
    () => new Map((exercises ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises],
  );
  const selectedExercises = exerciseIds
    .map((id) => exerciseById.get(id))
    .filter((exercise): exercise is Exercise => Boolean(exercise));

  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...BASE_WORKOUT_TYPES,
          ...(groups?.map((group) => `Split ${group.name}`) ?? []),
          type,
        ]),
      ),
    [groups, type],
  );

  const pending = createTemplate.isPending || updateTemplate.isPending;
  const waitingForTemplate =
    editing &&
    (templateLoading ||
      (!templateError && Boolean(template) && loadedTemplateId !== templateId));
  const loading = waitingForTemplate || exercisesLoading || groupsLoading;
  const loadError = templateError || exercisesError || groupsError;

  function addExercise(exercise: Exercise) {
    setExerciseIds((current) =>
      current.includes(exercise.id) ? current : [...current, exercise.id],
    );
    setError(null);
  }

  function removeExercise(exerciseId: string) {
    setExerciseIds((current) => current.filter((id) => id !== exerciseId));
  }

  function moveExercise(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= exerciseIds.length) return;
    setExerciseIds((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("templates.nameRequired"));
      return;
    }
    const validExerciseIds = exerciseIds.filter((id) => exerciseById.has(id));
    if (validExerciseIds.length === 0) {
      setError(t("templates.exercisesRequired"));
      return;
    }

    setError(null);
    const input = {
      name: trimmedName,
      type,
      exerciseIds: validExerciseIds,
    };

    if (templateId) {
      updateTemplate.mutate(
        { id: templateId, input },
        {
          onSuccess: () => router.replace(`/templates/${templateId}`),
          onError: (mutationError) =>
            setError((mutationError as Error).message),
        },
      );
      return;
    }

    createTemplate.mutate(input, {
      onSuccess: (id) => router.replace(`/templates/${id}`),
      onError: (mutationError) => setError((mutationError as Error).message),
    });
  }

  return (
    <AppShell
      title={t(editing ? "templates.edit" : "templates.new")}
      back
      action={
        !loading && !loadError ? (
          <Button
            type="button"
            variant="lime"
            size="sm"
            onClick={save}
            loading={pending}
          >
            {editing ? t("common.save") : t("templates.create")}
          </Button>
        ) : null
      }
    >
      {loading ? (
        <PageLoader />
      ) : loadError || (editing && !template) ? (
        <ErrorNote
          message={
            templateError
              ? t("templates.notFound")
              : t("common.error")
          }
        />
      ) : (
        <div className={styles.form}>
          <Field label={t("templates.name")}>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              placeholder={t("templates.namePlaceholder")}
              autoFocus={!editing}
              maxLength={100}
            />
          </Field>

          <Field label={t("workout.type")}>
            <div className={cn(styles.typeRow, "no-scrollbar")}>
              {typeOptions.map((option) => (
                <Chip
                  key={option}
                  selected={type === option}
                  onClick={() => setType(option)}
                >
                  {option}
                </Chip>
              ))}
            </div>
          </Field>

          <section>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>
                {t("templates.exercises")}
              </h2>
              <span className={styles.count}>{selectedExercises.length}</span>
            </div>

            {selectedExercises.length === 0 ? (
              <p className={styles.emptyExercises}>
                {t("templates.emptyExercises")}
              </p>
            ) : (
              <div className={styles.exerciseList}>
                {selectedExercises.map((exercise, index) => (
                  <div key={exercise.id} className={styles.exerciseRow}>
                    <span className={styles.position}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className={styles.exerciseText}>
                      <p className={styles.exerciseName}>{exercise.name}</p>
                      <p className={styles.exerciseMeta}>
                        {groups?.find(
                          (group) => group.id === exercise.muscle_group_id,
                        )?.name ?? ""}
                      </p>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={cn(styles.move, styles.moveUp)}
                        aria-label={t("templates.moveUp", {
                          name: exercise.name,
                        })}
                        disabled={index === 0}
                        onClick={() => moveExercise(index, -1)}
                      >
                        <IconChevronDown size={16} />
                      </button>
                      <button
                        type="button"
                        className={styles.move}
                        aria-label={t("templates.moveDown", {
                          name: exercise.name,
                        })}
                        disabled={index === selectedExercises.length - 1}
                        onClick={() => moveExercise(index, 1)}
                      >
                        <IconChevronDown size={16} />
                      </button>
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={t("templates.removeExercise", {
                          name: exercise.name,
                        })}
                        onClick={() => removeExercise(exercise.id)}
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="surface"
              block
              dashed
              className={styles.addExercise}
              onClick={() => setPickerOpen(true)}
            >
              <IconPlus size={18} />
              {t("workout.addExercise")}
            </Button>
          </section>

          {error && <ErrorNote message={error} />}

          <Button
            type="button"
            variant="gradient"
            size="lg"
            block
            onClick={save}
            loading={pending}
          >
            {editing ? t("common.saveChanges") : t("templates.create")}
          </Button>
        </div>
      )}

      <ExerciseSelectSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        exercises={exercises ?? []}
        groups={groups ?? []}
        selectedIds={new Set(exerciseIds)}
        onPick={addExercise}
      />
    </AppShell>
  );
}

function ExerciseSelectSheet({
  open,
  onClose,
  exercises,
  groups,
  selectedIds,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  groups: MuscleGroup[];
  selectedIds: Set<string>;
  onPick: (exercise: Exercise) => void;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return exercises.filter((exercise) => {
      if (selectedIds.has(exercise.id)) return false;
      if (groupFilter && exercise.muscle_group_id !== groupFilter) return false;
      return !query || exercise.name.toLowerCase().includes(query);
    });
  }, [exercises, groupFilter, search, selectedIds]);

  function close() {
    setSearch("");
    setGroupFilter(null);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t("workout.addExercise")}
      className={styles.pickerSheet}
    >
      <div className={styles.pickerStack}>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("picker.search")}
        />

        <div className={cn(styles.filterRow, "no-scrollbar")}>
          <Chip selected={groupFilter === null} onClick={() => setGroupFilter(null)}>
            {t("common.all")}
          </Chip>
          {groups.map((group) => (
            <Chip
              key={group.id}
              selected={groupFilter === group.id}
              onClick={() => setGroupFilter(group.id)}
            >
              {group.name}
            </Chip>
          ))}
        </div>

        <div className={styles.pickerList}>
          {filtered.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              className={styles.pickerItem}
              onClick={() => {
                onPick(exercise);
              }}
            >
              <span className={styles.pickerText}>
                <span className={styles.pickerName}>{exercise.name}</span>
                <span className={styles.pickerMeta}>
                  {groups.find((group) => group.id === exercise.muscle_group_id)
                    ?.name ?? ""}
                  {" · "}
                  {t(`equipment.${exercise.equipment}`)}
                </span>
              </span>
              <IconPlus size={18} className={styles.pickerPlus} />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className={styles.pickerEmpty}>
              {search.trim()
                ? t("picker.emptyFor", { query: search.trim() })
                : t("picker.empty")}
            </p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
