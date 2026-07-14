"use client";

import { useMemo, useState } from "react";
import {
  useCreateExercise,
  useExercises,
  type Exercise,
} from "@/entities/exercise";
import { useMuscleGroups } from "@/entities/muscle-group";
import { EQUIPMENT_OPTIONS, type Equipment } from "@/shared/config/workout";
import { useI18n } from "@/shared/i18n";
import { parseWeight, unitToKg, type Unit } from "@/shared/lib/weight";
import {
  Button,
  Chip,
  ErrorNote,
  Field,
  IconPlus,
  Input,
  PageLoader,
  Sheet,
  Tag,
  TextArea,
} from "@/shared/ui";

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
  const { data: groups } = useMuscleGroups();
  const { data: exercises, isLoading } = useExercises();
  const createExercise = useCreateExercise();

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // new exercise form
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Equipment>("free_weight");
  const [machineSettings, setMachineSettings] = useState("");
  const [workingWeight, setWorkingWeight] = useState("");
  const [unitChoice, setUnitChoice] = useState<"default" | Unit>("default");
  const [formError, setFormError] = useState<string | null>(null);

  const effectiveUnit: Unit = unitChoice === "default" ? unit : unitChoice;

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
    setName("");
    setEquipment("free_weight");
    setMachineSettings("");
    setWorkingWeight("");
    setUnitChoice("default");
    setFormError(null);
  }

  function handleCreate() {
    const trimmed = name.trim();
    const gid = groupId ?? groupFilter ?? groups?.[0]?.id;
    if (!trimmed) return setFormError(t("picker.errName"));
    if (!gid) return setFormError(t("picker.errGroup"));

    const weight = parseWeight(workingWeight);
    createExercise.mutate(
      {
        name: trimmed,
        muscle_group_id: gid,
        equipment,
        machine_settings:
          equipment === "machine" ? machineSettings.trim() || null : null,
        working_weight_kg:
          weight != null
            ? Math.round(unitToKg(weight, effectiveUnit) * 100) / 100
            : null,
        unit: unitChoice === "default" ? null : unitChoice,
      },
      {
        onSuccess: (exercise) => {
          resetCreateForm();
          onPick(exercise, groupName(exercise.muscle_group_id));
        },
        onError: (e) => setFormError((e as Error).message),
      },
    );
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        resetCreateForm();
        onClose();
      }}
      title={creating ? t("picker.newTitle") : t("picker.title")}
      className="min-h-[70dvh]"
    >
      {creating ? (
        <div className="space-y-4">
          <Field label={t("picker.name")}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("picker.namePlaceholder")}
              autoFocus
            />
          </Field>

          <Field label={t("picker.muscleGroup")}>
            <div className="flex flex-wrap gap-2">
              {groups?.map((group) => (
                <Chip
                  key={group.id}
                  selected={(groupId ?? groupFilter) === group.id}
                  onClick={() => setGroupId(group.id)}
                >
                  {group.name}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label={t("picker.equipment")}>
            <div className="flex flex-wrap gap-2">
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
                onChange={(e) => setMachineSettings(e.target.value)}
                placeholder={t("picker.machineSetupPlaceholder")}
              />
            </Field>
          )}

          <Field label={t("picker.unitForExercise")}>
            <div className="flex flex-wrap gap-2">
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

          <Field label={t("picker.workingWeight", { unit: effectiveUnit })}>
            <Input
              value={workingWeight}
              onChange={(e) =>
                setWorkingWeight(e.target.value.replace(/[^\d.,]/g, ""))
              }
              placeholder="60"
              inputMode="decimal"
            />
          </Field>

          {formError && <ErrorNote message={formError} />}

          <div className="flex gap-3 pt-1">
            <Button variant="surface" className="flex-1" onClick={resetCreateForm}>
              {t("common.back")}
            </Button>
            <Button
              variant="lime"
              className="flex-1"
              onClick={handleCreate}
              loading={createExercise.isPending}
            >
              {t("picker.createAdd")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("picker.search")}
          />

          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
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

          {isLoading ? (
            <PageLoader />
          ) : (
            <div className="space-y-2">
              {filtered.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() =>
                    onPick(exercise, groupName(exercise.muscle_group_id))
                  }
                  className="flex w-full items-center justify-between rounded-tile border border-line bg-raised px-4 py-3.5 text-left active:bg-line/50"
                >
                  <span>
                    <span className="block font-medium">{exercise.name}</span>
                    <span className="text-xs text-muted">
                      {groupName(exercise.muscle_group_id)} ·{" "}
                      {t(`equipment.${exercise.equipment}`)}
                    </span>
                  </span>
                  <IconPlus size={18} className="shrink-0 text-lime" />
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">
                  {search.trim()
                    ? t("picker.emptyFor", { query: search.trim() })
                    : t("picker.empty")}
                </p>
              )}
            </div>
          )}

          <Button
            variant="surface"
            className="w-full border-dashed"
            onClick={() => {
              setGroupId(groupFilter);
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
