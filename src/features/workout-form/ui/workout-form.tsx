"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, type CSSProperties } from "react";
import type { Exercise } from "@/entities/exercise";
import { useMuscleGroups } from "@/entities/muscle-group";
import { CompareButton } from "@/features/exercise-compare";
import { MachineInfoButton } from "@/features/machine-info";
import { PlateSheet, type PlateContext } from "@/features/plate-calculator";
import { BASE_WORKOUT_TYPES } from "@/shared/config/workout";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import {
  kgToUnit,
  parseSignedWeight,
  roundWeight,
  unitToKg,
  type Unit,
} from "@/shared/lib/weight";
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  Field,
  IconFlame,
  IconClose,
  IconNote,
  IconPlus,
  IconTrash,
  Input,
  Tag,
  TextArea,
} from "@/shared/ui";
import {
  exerciseToDraft,
  isDraftEmpty,
  draftBodyWeightKg,
  newSet,
  parseWeight,
  rebaseBodyweightExercises,
  type DraftExercise,
  type DraftSet,
  type WorkoutDraft,
} from "../model/draft";
import { CopyLastWorkout } from "./copy-last-workout";
import { CopyWorkoutPicker } from "./copy-workout-picker";
import { ExercisePicker } from "./exercise-picker";
import { TemplatePicker } from "./template-picker";
import styles from "./workout-form.module.scss";

interface WorkoutFormProps {
  value: WorkoutDraft;
  onChange: (draft: WorkoutDraft) => void;
  unit: Unit;
  /** Offer to copy the exercises of the last workout of the selected type. */
  enableCopyLast?: boolean;
}

export function WorkoutForm({
  value,
  onChange,
  unit,
  enableCopyLast,
}: WorkoutFormProps) {
  const { t } = useI18n();
  const { data: groups } = useMuscleGroups();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<{
    exercises: DraftExercise[];
    type: string;
  } | null>(null);
  const [plateContext, setPlateContext] = useState<PlateContext | null>(null);
  const bodyWeightKg = draftBodyWeightKg(value, unit);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const typeOptions = [
    ...BASE_WORKOUT_TYPES,
    ...(groups?.map((g) => `Split ${g.name}`) ?? []),
  ];

  function patch(partial: Partial<WorkoutDraft>) {
    onChange({ ...value, ...partial });
  }

  function patchExercise(key: string, partial: Partial<DraftExercise>) {
    patch({
      exercises: value.exercises.map((exercise) =>
        exercise.key === key ? { ...exercise, ...partial } : exercise,
      ),
    });
  }

  function patchSet(
    exerciseKey: string,
    setKey: string,
    partial: Partial<DraftSet>,
  ) {
    const exercise = value.exercises.find((e) => e.key === exerciseKey);
    if (!exercise) return;
    patchExercise(exerciseKey, {
      sets: exercise.sets.map((set) =>
        set.key === setKey ? { ...set, ...partial } : set,
      ),
    });
  }

  function showPlates(weightRaw: string, exercise: DraftExercise) {
    const weight = parseWeight(weightRaw);
    const exerciseUnit = exercise.unit ?? unit;
    if (weight != null) {
      setPlateContext({
        weightKg: unitToKg(weight, exerciseUnit),
        equipment: exercise.equipment,
        displayUnit: exerciseUnit,
      });
    }
  }

  function reorderExercises({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;

    const from = value.exercises.findIndex(
      (exercise) => exercise.key === active.id,
    );
    const to = value.exercises.findIndex(
      (exercise) => exercise.key === over.id,
    );
    if (from < 0 || to < 0) return;

    // One controlled update per completed pointer/keyboard drag. This keeps
    // localStorage and cloud-draft sync quiet while the item is moving.
    patch({ exercises: arrayMove(value.exercises, from, to) });
  }

  return (
    <div className={styles.form}>
      {/* Type */}
      <Field label={t("workout.type")}>
        <div className={cn(styles.typeRow, "no-scrollbar")}>
          {typeOptions.map((type) => (
            <Chip
              key={type}
              selected={value.type === type}
              onClick={() => patch({ type })}
            >
              {type}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Date */}
      <Field label={t("workout.date")}>
        <Input
          type="date"
          value={value.date}
          onChange={(e) => e.target.value && patch({ date: e.target.value })}
        />
      </Field>

      {/* Workout notes */}
      {value.showNotes ? (
        <Field label={t("workout.note")}>
          <div className={styles.noteWrap}>
            <TextArea
              value={value.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder={t("workout.notePlaceholder")}
            />
            <button
              type="button"
              aria-label={t("workout.removeNote")}
              className={styles.noteRemove}
              onClick={() => patch({ notes: "", showNotes: false })}
            >
              <IconClose size={16} />
            </button>
          </div>
        </Field>
      ) : (
        <button
          type="button"
          onClick={() => patch({ showNotes: true })}
          className={styles.addNote}
        >
          <IconNote size={16} />
          {t("workout.addNote")}
        </button>
      )}

      {/* Exercises */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={reorderExercises}
      >
        <SortableContext
          items={value.exercises.map((exercise) => exercise.key)}
          strategy={verticalListSortingStrategy}
        >
          <div className={styles.exercises}>
            {value.exercises.map((exercise, index) => (
              <ExerciseEditor
                key={exercise.key}
                index={index}
                exercise={exercise}
                canReorder={value.exercises.length > 1}
                workoutDate={value.date}
                unit={unit}
                bodyWeightKg={bodyWeightKg}
                onPatch={(partial) => patchExercise(exercise.key, partial)}
                onPatchSet={(setKey, partial) =>
                  patchSet(exercise.key, setKey, partial)
                }
                onRemove={() =>
                  patch({
                    exercises: value.exercises.filter(
                      (e) => e.key !== exercise.key,
                    ),
                  })
                }
                onShowPlates={showPlates}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {enableCopyLast && isDraftEmpty(value) && (
        <>
          <CopyLastWorkout
            type={value.type}
            date={value.date}
            unit={unit}
            onCopy={(exercises) =>
              patch({
                exercises: [
                  ...value.exercises,
                  ...rebaseBodyweightExercises(exercises, bodyWeightKg),
                ],
                notes: "",
                showNotes: false,
              })
            }
          />
          <CopyWorkoutPicker
            unit={unit}
            onCopy={(exercises, type) =>
              patch({
                exercises: [
                  ...value.exercises,
                  ...rebaseBodyweightExercises(exercises, bodyWeightKg),
                ],
                type,
                notes: "",
                showNotes: false,
              })
            }
          />
          <TemplatePicker
            unit={unit}
            bodyWeightKg={bodyWeightKg}
            onApply={(exercises, type) => {
              if (!isDraftEmpty(value)) {
                setPendingTemplate({ exercises, type });
                return;
              }
              patch({
                exercises,
                type,
                notes: "",
                showNotes: false,
              });
            }}
          />
        </>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className={styles.addExercise}
      >
        <IconPlus size={20} />
        {t("workout.addExercise")}
      </button>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        unit={unit}
        onPick={(picked: Exercise, muscleGroupName: string) => {
          patch({
            exercises: [
              ...value.exercises,
              exerciseToDraft(picked, muscleGroupName, unit, bodyWeightKg),
            ],
          });
          setPickerOpen(false);
        }}
      />

      <PlateSheet
        context={plateContext}
        onClose={() => setPlateContext(null)}
      />

      <ConfirmSheet
        open={pendingTemplate != null}
        onClose={() => setPendingTemplate(null)}
        title={t("workout.templateReplaceTitle")}
        message={t("workout.templateReplaceMessage")}
        confirmLabel={t("workout.templateReplaceConfirm")}
        onConfirm={() => {
          if (!pendingTemplate) return;
          patch({
            exercises: pendingTemplate.exercises,
            type: pendingTemplate.type,
            notes: "",
            showNotes: false,
          });
          setPendingTemplate(null);
        }}
      />
    </div>
  );
}

interface ExerciseEditorProps {
  index: number;
  exercise: DraftExercise;
  canReorder: boolean;
  /** The draft workout's date — compare offers only sessions before it. */
  workoutDate: string;
  unit: Unit;
  bodyWeightKg: number | null;
  onPatch: (partial: Partial<DraftExercise>) => void;
  onPatchSet: (setKey: string, partial: Partial<DraftSet>) => void;
  onRemove: () => void;
  onShowPlates: (weightRaw: string, exercise: DraftExercise) => void;
}

function ExerciseEditor({
  index,
  exercise,
  canReorder,
  workoutDate,
  unit,
  bodyWeightKg,
  onPatch,
  onPatchSet,
  onRemove,
  onShowPlates,
}: ExerciseEditorProps) {
  const { t } = useI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.key, disabled: !canReorder });
  const sortableStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      className={cn(
        styles.sortableExercise,
        isDragging && styles.sortableDragging,
      )}
    >
      <Card variant="surface" className={styles.exerciseCard}>
        <div className={styles.exerciseHeader}>
          <button
            ref={setActivatorNodeRef}
            type="button"
            disabled={!canReorder}
            className={styles.dragHandle}
            {...attributes}
            {...listeners}
            aria-label={t("exercise.reorder", { name: exercise.name })}
          >
            <GripGlyph />
            <span className={styles.exerciseIndex}>
              {String(index + 1).padStart(2, "0")}
            </span>
          </button>
        <div className={styles.exerciseTitle}>
          <p className={styles.exerciseName}>{exercise.name}</p>
          <Tag className={styles.exerciseGroup}>{exercise.muscleGroupName}</Tag>
        </div>
        {exercise.equipment === "machine" && (
          <MachineInfoButton
            exerciseId={exercise.exerciseId}
            exerciseName={exercise.name}
            machineSettings={exercise.machineSettings}
          />
        )}
        <CompareButton
          exerciseId={exercise.exerciseId}
          exerciseName={exercise.name}
          unit={exercise.unit ?? unit}
          currentSets={exercise.sets}
          currentBodyWeightKg={bodyWeightKg}
          currentDate={workoutDate}
        />
        <button
          type="button"
          aria-label={t("exercise.note")}
          onClick={() => onPatch({ showNotes: !exercise.showNotes })}
          className={cn(
            styles.iconToggle,
            (exercise.showNotes || exercise.notes) && styles.iconToggleActive,
          )}
        >
          <IconNote size={16} />
        </button>
        <button
          type="button"
          aria-label={t("exercise.remove")}
          onClick={onRemove}
          className={styles.iconToggle}
        >
          <IconTrash size={15} />
        </button>
        </div>

      {/* Sets header */}
      <div className={styles.setsHeader}>
        <span>#</span>
        <span
          className={
            exercise.unit !== unit ? styles.headerUnitOverride : undefined
          }
        >
          {exercise.equipment === "bodyweight"
            ? t("set.addedLoad", { unit: exercise.unit ?? unit })
            : t("set.weight", { unit: exercise.unit ?? unit })}
        </span>
        <span>{t("set.reps")}</span>
        <span style={{ textAlign: "center" }}>{t("set.fail")}</span>
        <span />
      </div>

      <div className={styles.setRows}>
        {exercise.sets.map((set, setIndex) => (
          <div key={set.key} className={styles.setRow}>
            <span className={styles.setIndex}>{setIndex + 1}</span>

            {exercise.equipment === "bodyweight" ? (
              <BodyweightLoadInput
                set={set}
                unit={exercise.unit ?? unit}
                bodyWeightKg={bodyWeightKg}
                onChange={(addedWeight, totalWeight) =>
                  onPatchSet(set.key, {
                    addedWeight,
                    weight: totalWeight,
                  })
                }
              />
            ) : (
              <div className={styles.weightWrap}>
                <Input
                  value={set.weight}
                  inputMode="decimal"
                  placeholder="0"
                  className={
                    exercise.equipment === "crossover"
                      ? styles.setInput
                      : styles.setInputPadded
                  }
                  onChange={(e) =>
                    onPatchSet(set.key, {
                      weight: e.target.value.replace(/[^\d.,]/g, ""),
                    })
                  }
                />
                {/* crossover is a cable stack — no plates to break down */}
                {exercise.equipment !== "crossover" && (
                  <button
                    type="button"
                    aria-label={t("set.plates")}
                    onClick={() => onShowPlates(set.weight, exercise)}
                    className={styles.platesButton}
                  >
                    <PlatesGlyph />
                  </button>
                )}
              </div>
            )}

            <Input
              value={set.reps}
              inputMode="numeric"
              placeholder="0"
              className={styles.setInput}
              onChange={(e) =>
                onPatchSet(set.key, {
                  reps: e.target.value.replace(/\D/g, ""),
                })
              }
            />

            <button
              type="button"
              role="switch"
              aria-checked={set.toFailure}
              aria-label={t("set.toFailure")}
              onClick={() => onPatchSet(set.key, { toFailure: !set.toFailure })}
              className={cn(
                styles.failButton,
                set.toFailure && styles.failActive,
              )}
            >
              <IconFlame size={17} />
            </button>

            <button
              type="button"
              aria-label={t("set.removeSet")}
              onClick={() =>
                onPatch({
                  sets: exercise.sets.filter((s) => s.key !== set.key),
                })
              }
              disabled={exercise.sets.length === 1}
              className={styles.removeSet}
            >
              <IconClose size={16} />
            </button>
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        tone="lime"
        className={styles.addSet}
        onClick={() =>
          onPatch({
            sets: [...exercise.sets, newSet(exercise.sets.at(-1))],
          })
        }
      >
        <IconPlus size={16} />
        {t("set.addSet")}
      </Button>

      {exercise.showNotes && (
        <TextArea
          value={exercise.notes}
          onChange={(e) => onPatch({ notes: e.target.value })}
          placeholder={t("exercise.notePlaceholder")}
          rows={2}
          className={styles.exerciseNote}
        />
      )}
      </Card>
    </div>
  );
}

function BodyweightLoadInput({
  set,
  unit,
  bodyWeightKg,
  onChange,
}: {
  set: DraftSet;
  unit: Unit;
  bodyWeightKg: number | null;
  onChange: (addedWeight: string, totalWeight: string) => void;
}) {
  const { t } = useI18n();
  const body =
    bodyWeightKg != null ? roundWeight(kgToUnit(bodyWeightKg, unit)) : null;
  const added = parseSignedWeight(set.addedWeight ?? "") ?? 0;
  const total = body != null ? roundWeight(body + added) : null;

  return (
    <div className={styles.bodyweightLoad}>
      <div className={styles.bodyweightEquation}>
        <span className={styles.bodyweightBase}>
          {body ?? "—"}
          <small>{unit}</small>
        </span>
        <span className={styles.bodyweightOperator}>+</span>
        <Input
          value={set.addedWeight ?? ""}
          inputMode="decimal"
          placeholder="0"
          aria-label={t("set.addedLoad", { unit })}
          className={styles.bodyweightInput}
          onChange={(event) => {
            const next = event.target.value.replace(/\s/g, "");
            if (!/^[+-]?\d*(?:[.,]\d*)?$/.test(next)) return;
            const nextAdded = parseSignedWeight(next) ?? 0;
            onChange(
              next,
              body != null ? String(roundWeight(body + nextAdded)) : "",
            );
          }}
        />
      </div>
      <span className={styles.bodyweightTotal}>
        {t("set.totalLoad")}: {total ?? "—"} {unit}
      </span>
    </div>
  );
}

/** Tiny plates icon (concentric circles). */
function PlatesGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

/** Six-dot grip kept local to the form so the activator stays lightweight. */
function GripGlyph() {
  return (
    <svg
      width="12"
      height="18"
      viewBox="0 0 12 18"
      fill="currentColor"
      aria-hidden="true"
    >
      {[3, 9, 15].flatMap((y) => [
        <circle key={`left-${y}`} cx="3" cy={y} r="1.25" />,
        <circle key={`right-${y}`} cx="9" cy={y} r="1.25" />,
      ])}
    </svg>
  );
}
