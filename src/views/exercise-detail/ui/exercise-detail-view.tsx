"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  useDeleteExercise,
  useExercise,
  useUpdateExercise,
} from "@/entities/exercise";
import { useMuscleGroups } from "@/entities/muscle-group";
import { useProfile } from "@/entities/user";
import { useExerciseHistory } from "@/entities/workout";
import {
  ProgressChart,
  RepsByWeightTable,
  exerciseSummary,
  progressSeries,
  repStatsByWeight,
  seriesToUnit,
} from "@/features/exercise-stats";
import { MachineInfoButton } from "@/features/machine-info";
import { PlateSheet } from "@/features/plate-calculator";
import { EQUIPMENT_OPTIONS, type Equipment } from "@/shared/config/workout";
import { useI18n } from "@/shared/i18n";
import { formatDay } from "@/shared/lib/dates";
import {
  kgToUnit,
  parseWeight,
  roundWeight,
  unitToKg,
} from "@/shared/lib/weight";
import { AppShell } from "@/widgets/app-shell";
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  DotValue,
  ErrorNote,
  Field,
  IconEdit,
  IconFlame,
  IconPlates,
  Input,
  PageLoader,
  Sheet,
  Tag,
  TextArea,
} from "@/shared/ui";

export function ExerciseDetailView({ exerciseId }: { exerciseId: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const { data: exercise, isLoading } = useExercise(exerciseId);
  const { data: groups } = useMuscleGroups();
  const { data: profile } = useProfile();
  const { data: history } = useExerciseHistory(exerciseId);

  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [platesOpen, setPlatesOpen] = useState(false);

  const unit = exercise?.unit ?? profile?.unit ?? "kg";
  const groupName =
    groups?.find((g) => g.id === exercise?.muscle_group_id)?.name ?? "";

  const summary = useMemo(
    () => exerciseSummary(history ?? []),
    [history],
  );
  const repStats = useMemo(() => repStatsByWeight(history ?? []), [history]);
  const chartPoints = useMemo(
    () => seriesToUnit(progressSeries(history ?? []), unit),
    [history, unit],
  );

  const recent = useMemo(() => {
    const byWorkout = new Map<
      string,
      { date: string; sets: typeof history }
    >();
    for (const record of history ?? []) {
      const entry = byWorkout.get(record.workoutId) ?? {
        date: record.workoutDate,
        sets: [],
      };
      entry.sets!.push(record);
      byWorkout.set(record.workoutId, entry);
    }
    return [...byWorkout.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [history]);

  if (isLoading || !exercise) {
    return (
      <AppShell title={t("detail.title")} back>
        <PageLoader />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={exercise.name}
      back
      action={
        <button
          type="button"
          aria-label={t("detail.editExercise")}
          onClick={() => setEditOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-raised text-muted"
        >
          <IconEdit size={17} />
        </button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="lime">{groupName}</Tag>
          <Tag>{t(`equipment.${exercise.equipment}`)}</Tag>
          {exercise.unit != null && exercise.unit !== profile?.unit && (
            <Tag tone="pink">{t("detail.inUnit", { unit: exercise.unit })}</Tag>
          )}
          {exercise.equipment === "machine" && (
            <MachineInfoButton
              exerciseId={exercise.id}
              exerciseName={exercise.name}
              machineSettings={exercise.machine_settings}
            />
          )}
        </div>

        {/* Working weight */}
        <Card variant="pink" className="p-6">
          <div className="dots-bg pointer-events-none absolute inset-0 opacity-25" />
          <div className="relative">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-white/80">
                {t("detail.currentWorking")}
              </p>
              <div className="flex gap-2">
                {exercise.equipment !== "crossover" && (
                  <button
                    type="button"
                    aria-label={t("set.plates")}
                    onClick={() => setPlatesOpen(true)}
                    disabled={exercise.working_weight_kg == null}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-40"
                  >
                    <IconPlates size={17} />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={t("detail.editWorking")}
                  onClick={() => setWeightSheetOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white"
                >
                  <IconEdit size={15} />
                </button>
              </div>
            </div>
            <DotValue
              value={
                exercise.working_weight_kg != null
                  ? roundWeight(kgToUnit(exercise.working_weight_kg, unit))
                  : "—"
              }
              suffix={unit}
              className="text-6xl text-white"
              suffixClassName="text-lg text-white/70"
            />
          </div>
        </Card>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile label={t("detail.sessions")} value={summary.sessions} />
          <StatTile label={t("detail.totalSets")} value={summary.totalSets} />
          <StatTile
            label={t("detail.bestWeight")}
            value={
              summary.bestWeightKg != null
                ? roundWeight(kgToUnit(summary.bestWeightKg, unit))
                : "—"
            }
            suffix={summary.bestWeightKg != null ? unit : undefined}
          />
          <StatTile
            label={t("detail.est1rm")}
            value={
              summary.estOneRepMaxKg != null
                ? roundWeight(kgToUnit(summary.estOneRepMaxKg, unit))
                : "—"
            }
            suffix={summary.estOneRepMaxKg != null ? unit : undefined}
          />
        </div>

        {/* Progress */}
        {chartPoints.length > 1 && (
          <Card variant="indigo" className="p-5 text-white">
            <p className="mb-3 text-sm font-medium text-white/80">
              {t("detail.topSet")}
            </p>
            <ProgressChart points={chartPoints} unit={unit} />
          </Card>
        )}

        {/* Reps by weight */}
        {repStats.length > 0 && (
          <Card variant="surface" className="p-4">
            <p className="mb-3 text-sm font-medium text-muted">
              {t("detail.repsByWeight")}
            </p>
            <RepsByWeightTable stats={repStats} unit={unit} />
          </Card>
        )}

        {/* Recent history */}
        {recent.length > 0 && (
          <Card variant="surface" className="p-4">
            <p className="mb-3 text-sm font-medium text-muted">
              {t("detail.recent")}
            </p>
            <div className="space-y-3">
              {recent.map((entry) => (
                <div key={entry.date + entry.sets![0]?.workoutId}>
                  <p className="mb-1 text-xs text-faint">
                    {formatDay(entry.date)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.sets!.map((set, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2.5 py-1 text-xs"
                      >
                        <span className="font-dot">
                          {set.weight_kg != null
                            ? roundWeight(kgToUnit(set.weight_kg, unit))
                            : "—"}
                        </span>
                        <span className="text-faint">×</span>
                        <span className="font-dot">{set.reps ?? "—"}</span>
                        {set.to_failure && (
                          <IconFlame size={12} className="text-flame" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {(history?.length ?? 0) === 0 && (
          <p className="py-4 text-center text-sm text-muted">
            {t("detail.noSets")}
          </p>
        )}
      </div>

      <WorkingWeightSheet
        open={weightSheetOpen}
        onClose={() => setWeightSheetOpen(false)}
        exerciseId={exercise.id}
        currentKg={exercise.working_weight_kg}
        unit={unit}
      />

      <EditExerciseSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        exercise={exercise}
        onDeleted={() => router.push("/exercises")}
      />

      <PlateSheet
        context={
          platesOpen && exercise.working_weight_kg != null
            ? {
                weightKg: exercise.working_weight_kg,
                equipment: exercise.equipment,
                displayUnit: unit,
              }
            : null
        }
        onClose={() => setPlatesOpen(false)}
      />
    </AppShell>
  );
}

function StatTile({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="rounded-tile border border-line/60 bg-surface px-4 py-3.5">
      <p className="mb-1.5 text-[11px] font-medium tracking-wide text-faint uppercase">
        {label}
      </p>
      <DotValue value={value} suffix={suffix} className="text-2xl" />
    </div>
  );
}

function WorkingWeightSheet({
  open,
  onClose,
  exerciseId,
  currentKg,
  unit,
}: {
  open: boolean;
  onClose: () => void;
  exerciseId: string;
  currentKg: number | null;
  unit: "kg" | "lb";
}) {
  const { t } = useI18n();
  const update = useUpdateExercise();
  const [value, setValue] = useState(() =>
    currentKg != null ? String(roundWeight(kgToUnit(currentKg, unit))) : "",
  );

  function save() {
    const parsed = parseWeight(value);
    update.mutate(
      {
        id: exerciseId,
        patch: {
          working_weight_kg:
            parsed != null
              ? Math.round(unitToKg(parsed, unit) * 100) / 100
              : null,
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("detail.workingWeight")}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{t("detail.workingWeightHint")}</p>
        <Field label={t("detail.weightUnit", { unit })}>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
            inputMode="decimal"
            placeholder="60"
            autoFocus
            className="text-center font-dot text-2xl"
          />
        </Field>
        <Button
          variant="lime"
          size="lg"
          className="w-full"
          onClick={save}
          loading={update.isPending}
        >
          {t("common.save")}
        </Button>
      </div>
    </Sheet>
  );
}

function EditExerciseSheet({
  open,
  onClose,
  exercise,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  exercise: {
    id: string;
    name: string;
    muscle_group_id: string;
    equipment: Equipment;
    machine_settings: string | null;
    unit: "kg" | "lb" | null;
  };
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const { data: groups } = useMuscleGroups();
  const { data: profile } = useProfile();
  const update = useUpdateExercise();
  const remove = useDeleteExercise();

  const [name, setName] = useState(exercise.name);
  const [groupId, setGroupId] = useState(exercise.muscle_group_id);
  const [equipment, setEquipment] = useState<Equipment>(exercise.equipment);
  const [machineSettings, setMachineSettings] = useState(
    exercise.machine_settings ?? "",
  );
  const [unitChoice, setUnitChoice] = useState<"default" | "kg" | "lb">(
    exercise.unit ?? "default",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!name.trim()) return setError(t("detail.nameEmpty"));
    update.mutate(
      {
        id: exercise.id,
        patch: {
          name: name.trim(),
          muscle_group_id: groupId,
          equipment,
          machine_settings:
            equipment === "machine" ? machineSettings.trim() || null : null,
          unit: unitChoice === "default" ? null : unitChoice,
        },
      },
      {
        onSuccess: onClose,
        onError: (e) => setError((e as Error).message),
      },
    );
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={t("detail.editExercise")}>
        <div className="space-y-4">
          <Field label={t("picker.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("picker.muscleGroup")}>
            <div className="flex flex-wrap gap-2">
              {groups?.map((group) => (
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
            <Field label={t("detail.machineSetup")}>
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
                  {
                    value: "default",
                    label: t("picker.unitDefault", {
                      unit: profile?.unit ?? "kg",
                    }),
                  },
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
          {error && <ErrorNote message={error} />}
          <Button
            variant="lime"
            size="lg"
            className="w-full"
            onClick={save}
            loading={update.isPending}
          >
            {t("common.saveChanges")}
          </Button>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => setConfirmDelete(true)}
          >
            {t("detail.deleteExercise")}
          </Button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("detail.deleteTitle")}
        message={t("detail.deleteMessage")}
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(exercise.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              onDeleted();
            },
          })
        }
      />
    </>
  );
}
