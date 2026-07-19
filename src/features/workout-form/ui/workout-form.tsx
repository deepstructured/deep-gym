"use client";

import { useState } from "react";
import type { Exercise } from "@/entities/exercise";
import { useMuscleGroups } from "@/entities/muscle-group";
import { CompareButton } from "@/features/exercise-compare";
import { MachineInfoButton } from "@/features/machine-info";
import { PlateSheet, type PlateContext } from "@/features/plate-calculator";
import { BASE_WORKOUT_TYPES } from "@/shared/config/workout";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { unitToKg, type Unit } from "@/shared/lib/weight";
import {
  Button,
  Card,
  Chip,
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
  newSet,
  parseWeight,
  type DraftExercise,
  type DraftSet,
  type WorkoutDraft,
} from "../model/draft";
import { CopyLastWorkout } from "./copy-last-workout";
import { CopyWorkoutPicker } from "./copy-workout-picker";
import { ExercisePicker } from "./exercise-picker";
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
  const [plateContext, setPlateContext] = useState<PlateContext | null>(null);

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
      <div className={styles.exercises}>
        {value.exercises.map((exercise, index) => (
          <ExerciseEditor
            key={exercise.key}
            index={index}
            exercise={exercise}
            workoutDate={value.date}
            unit={unit}
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

      {enableCopyLast && value.exercises.length === 0 && (
        <>
          <CopyLastWorkout
            type={value.type}
            date={value.date}
            unit={unit}
            onCopy={(exercises) =>
              patch({ exercises: [...value.exercises, ...exercises] })
            }
          />
          <CopyWorkoutPicker
            unit={unit}
            onCopy={(exercises, type) =>
              patch({ exercises: [...value.exercises, ...exercises], type })
            }
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
              exerciseToDraft(picked, muscleGroupName, unit),
            ],
          });
          setPickerOpen(false);
        }}
      />

      <PlateSheet
        context={plateContext}
        onClose={() => setPlateContext(null)}
      />
    </div>
  );
}

interface ExerciseEditorProps {
  index: number;
  exercise: DraftExercise;
  /** The draft workout's date — compare offers only sessions before it. */
  workoutDate: string;
  unit: Unit;
  onPatch: (partial: Partial<DraftExercise>) => void;
  onPatchSet: (setKey: string, partial: Partial<DraftSet>) => void;
  onRemove: () => void;
  onShowPlates: (weightRaw: string, exercise: DraftExercise) => void;
}

function ExerciseEditor({
  index,
  exercise,
  workoutDate,
  unit,
  onPatch,
  onPatchSet,
  onRemove,
  onShowPlates,
}: ExerciseEditorProps) {
  const { t } = useI18n();
  return (
    <Card variant="surface" className={styles.exerciseCard}>
      <div className={styles.exerciseHeader}>
        <span className={styles.exerciseIndex}>
          {String(index + 1).padStart(2, "0")}
        </span>
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
          {t("set.weight", { unit: exercise.unit ?? unit })}
        </span>
        <span>{t("set.reps")}</span>
        <span style={{ textAlign: "center" }}>{t("set.fail")}</span>
        <span />
      </div>

      <div className={styles.setRows}>
        {exercise.sets.map((set, setIndex) => (
          <div key={set.key} className={styles.setRow}>
            <span className={styles.setIndex}>{setIndex + 1}</span>

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
