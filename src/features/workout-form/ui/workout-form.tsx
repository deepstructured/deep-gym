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
import { ExercisePicker } from "./exercise-picker";

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
    <div className="space-y-5">
      {/* Type */}
      <Field label={t("workout.type")}>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
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
          <div className="relative">
            <TextArea
              value={value.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder={t("workout.notePlaceholder")}
            />
            <button
              type="button"
              aria-label={t("workout.removeNote")}
              className="absolute top-2 right-2 text-faint"
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
          className="flex items-center gap-2 text-sm font-medium text-muted"
        >
          <IconNote size={16} />
          {t("workout.addNote")}
        </button>
      )}

      {/* Exercises */}
      <div className="space-y-4">
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
        <CopyLastWorkout
          type={value.type}
          unit={unit}
          onCopy={(exercises) =>
            patch({ exercises: [...value.exercises, ...exercises] })
          }
        />
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-card border border-dashed border-line bg-surface/50 font-medium text-lime active:bg-surface"
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
    <Card variant="surface" className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-dot text-lg text-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{exercise.name}</p>
          <Tag className="mt-0.5">{exercise.muscleGroupName}</Tag>
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
            "flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised",
            exercise.showNotes || exercise.notes ? "text-lime" : "text-muted",
          )}
        >
          <IconNote size={16} />
        </button>
        <button
          type="button"
          aria-label={t("exercise.remove")}
          onClick={onRemove}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-muted"
        >
          <IconTrash size={15} />
        </button>
      </div>

      {/* Sets header */}
      <div className="mb-1 grid grid-cols-[1.6rem_1fr_1fr_2.4rem_1.8rem] items-center gap-2 px-1 text-[11px] font-medium tracking-wide text-faint uppercase">
        <span>#</span>
        <span className={exercise.unit !== unit ? "text-lime/80" : undefined}>
          {t("set.weight", { unit: exercise.unit ?? unit })}
        </span>
        <span>{t("set.reps")}</span>
        <span className="text-center">{t("set.fail")}</span>
        <span />
      </div>

      <div className="space-y-2">
        {exercise.sets.map((set, setIndex) => (
          <div
            key={set.key}
            className="grid grid-cols-[1.6rem_1fr_1fr_2.4rem_1.8rem] items-center gap-2"
          >
            <span className="px-1 font-dot text-sm text-faint">
              {setIndex + 1}
            </span>

            <div className="relative">
              <Input
                value={set.weight}
                inputMode="decimal"
                placeholder="0"
                className={
                  exercise.equipment === "crossover" ? "h-11" : "h-11 pr-9"
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
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-faint active:text-lime"
                >
                  <PlatesGlyph />
                </button>
              )}
            </div>

            <Input
              value={set.reps}
              inputMode="numeric"
              placeholder="0"
              className="h-11"
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
                "mx-auto flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                set.toFailure
                  ? "border-flame/50 bg-flame/20 text-[#ff7a5c]"
                  : "border-line bg-raised text-faint",
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
              className="flex h-9 w-8 items-center justify-center text-faint disabled:opacity-30"
            >
              <IconClose size={16} />
            </button>
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-2 text-lime"
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
          className="mt-2"
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
