"use client";

import { useState } from "react";
import { EQUIPMENT_OPTIONS, type Equipment } from "@/shared/config/workout";
import { useI18n } from "@/shared/i18n";
import { parseWeight, unitToKg, type Unit } from "@/shared/lib/weight";
import {
  Button,
  Chip,
  ErrorNote,
  Field,
  Input,
  TextArea,
} from "@/shared/ui";
import { useCreateExercise } from "../api/queries";
import type { Exercise } from "../model/types";
import styles from "./exercise-create-form.module.scss";

export interface ExerciseFormGroup {
  id: string;
  name: string;
}

interface ExerciseCreateFormProps {
  groups: ExerciseFormGroup[];
  unit: Unit;
  defaultGroupId?: string | null;
  submitLabel: string;
  cancelLabel?: string;
  onCreated: (exercise: Exercise, muscleGroupName: string) => void;
  onCancel?: () => void;
}

/** Shared exercise creation form used by the workout picker and catalog. */
export function ExerciseCreateForm({
  groups,
  unit,
  defaultGroupId,
  submitLabel,
  cancelLabel,
  onCreated,
  onCancel,
}: ExerciseCreateFormProps) {
  const { t } = useI18n();
  const createExercise = useCreateExercise();
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<string | null>(
    defaultGroupId ?? groups[0]?.id ?? null,
  );
  const [equipment, setEquipment] = useState<Equipment>("free_weight");
  const [machineSettings, setMachineSettings] = useState("");
  const [workingWeight, setWorkingWeight] = useState("");
  const [unitChoice, setUnitChoice] = useState<"default" | Unit>("default");
  const [formError, setFormError] = useState<string | null>(null);

  const effectiveUnit: Unit = unitChoice === "default" ? unit : unitChoice;

  function submit() {
    const trimmed = name.trim();
    const selectedGroup =
      groups.find((group) => group.id === groupId) ?? groups[0];
    if (!trimmed) return setFormError(t("picker.errName"));
    if (!selectedGroup) return setFormError(t("picker.errGroup"));

    const weight = parseWeight(workingWeight);
    setFormError(null);
    createExercise.mutate(
      {
        name: trimmed,
        muscle_group_id: selectedGroup.id,
        equipment,
        machine_settings:
          equipment === "machine" ? machineSettings.trim() || null : null,
        working_weight_kg:
          equipment === "bodyweight"
            ? null
            : weight != null
            ? Math.round(unitToKg(weight, effectiveUnit) * 100) / 100
            : null,
        unit: unitChoice === "default" ? null : unitChoice,
      },
      {
        onSuccess: (exercise) => onCreated(exercise, selectedGroup.name),
        onError: (error) => setFormError((error as Error).message),
      },
    );
  }

  return (
    <div className={styles.stack}>
      <Field label={t("picker.name")}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("picker.namePlaceholder")}
          autoFocus
        />
      </Field>

      <Field label={t("picker.muscleGroup")}>
        <div className={styles.chips}>
          {groups.map((group) => (
            <Chip
              key={group.id}
              selected={groupId === group.id}
              onClick={() => setGroupId(group.id)}
            >
              {group.name}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label={t("picker.equipment")}>
        <div className={styles.chips}>
          {EQUIPMENT_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              selected={equipment === option.value}
              onClick={() => setEquipment(option.value)}
            >
              {t(`equipment.${option.value}`)}
            </Chip>
          ))}
        </div>
      </Field>

      {equipment === "machine" && (
        <Field label={t("picker.machineSetupOptional")}>
          <TextArea
            value={machineSettings}
            onChange={(event) => setMachineSettings(event.target.value)}
            placeholder={t("picker.machineSetupPlaceholder")}
          />
        </Field>
      )}

      <Field label={t("picker.unitForExercise")}>
        <div className={styles.chips}>
          {(
            [
              { value: "default", label: t("picker.unitDefault", { unit }) },
              { value: "kg", label: "kg" },
              { value: "lb", label: "lb" },
            ] as const
          ).map((option) => (
            <Chip
              key={option.value}
              selected={unitChoice === option.value}
              onClick={() => setUnitChoice(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </Field>

      {equipment !== "bodyweight" && (
        <Field label={t("picker.workingWeight", { unit: effectiveUnit })}>
          <Input
            value={workingWeight}
            onChange={(event) =>
              setWorkingWeight(event.target.value.replace(/[^\d.,]/g, ""))
            }
            placeholder="60"
            inputMode="decimal"
          />
        </Field>
      )}

      {formError && <ErrorNote message={formError} />}

      <div className={styles.actions}>
        {onCancel && (
          <Button variant="surface" grow onClick={onCancel}>
            {cancelLabel ?? t("common.back")}
          </Button>
        )}
        <Button
          variant="lime"
          grow
          onClick={submit}
          loading={createExercise.isPending}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
