"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  useDeleteExercise,
  useExercise,
  useExerciseUsageCount,
  useUpdateExercise,
} from "@/entities/exercise";
import { useMuscleGroups } from "@/entities/muscle-group";
import { useProfile } from "@/entities/user";
import {
  useExerciseHistory,
  type ExerciseSetRecord,
} from "@/entities/workout";
import {
  ProgressChart,
  RepsByWeightTable,
  exerciseSummary,
  metricSeries,
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
import { cn } from "@/shared/lib/cn";
import styles from "./exercise-detail-view.module.scss";

export function ExerciseDetailView({ exerciseId }: { exerciseId: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const { data: exercise, isLoading } = useExercise(exerciseId);
  const { data: groups } = useMuscleGroups();
  const { data: profile } = useProfile();
  const { data: history } = useExerciseHistory(exerciseId);
  const exerciseUsage = useExerciseUsageCount(exerciseId);

  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [platesOpen, setPlatesOpen] = useState(false);

  const unit = exercise?.unit ?? profile?.unit ?? "kg";
  const isBodyweight = exercise?.equipment === "bodyweight";
  const loadMode = isBodyweight ? "bodyweight" : "external";
  const groupName =
    groups?.find((g) => g.id === exercise?.muscle_group_id)?.name ?? "";

  const summary = useMemo(
    () => exerciseSummary(history ?? [], { loadMode }),
    [history, loadMode],
  );
  const repStats = useMemo(
    () => repStatsByWeight(history ?? [], { loadMode }),
    [history, loadMode],
  );
  const chartPoints = useMemo(
    () => seriesToUnit(progressSeries(history ?? []), unit),
    [history, unit],
  );
  const repsChartPoints = useMemo(
    () =>
      metricSeries(history ?? [], "reps").map((point) => ({
        date: point.date,
        value: point.valueKg,
      })),
    [history],
  );
  const addedLoadChartPoints = useMemo(
    () => seriesToUnit(metricSeries(history ?? [], "addedLoad"), unit),
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
          className={styles.editButton}
        >
          <IconEdit size={17} />
        </button>
      }
    >
      <div className={styles.stack}>
        <div className={styles.tags}>
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
        <Card variant="pink" className={styles.workingCard}>
          <div className={cn(styles.workingDots, "dots-bg")} />
          <div className={styles.workingInner}>
            <div className={styles.workingHead}>
              <p className={styles.workingLabel}>
                {isBodyweight
                  ? t("bodyWeight.title")
                  : t("detail.currentWorking")}
              </p>
              {!isBodyweight && (
                <div className={styles.workingActions}>
                  {exercise.equipment !== "crossover" && (
                    <button
                      type="button"
                      aria-label={t("set.plates")}
                      onClick={() => setPlatesOpen(true)}
                      disabled={exercise.working_weight_kg == null}
                      className={styles.workingAction}
                    >
                      <IconPlates size={17} />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={t("detail.editWorking")}
                    onClick={() => setWeightSheetOpen(true)}
                    className={styles.workingAction}
                  >
                    <IconEdit size={15} />
                  </button>
                </div>
              )}
            </div>
            <DotValue
              value={
                isBodyweight
                  ? profile?.body_weight_kg != null
                    ? roundWeight(kgToUnit(profile.body_weight_kg, unit))
                    : "—"
                  : exercise.working_weight_kg != null
                    ? roundWeight(kgToUnit(exercise.working_weight_kg, unit))
                  : "—"
              }
              suffix={
                isBodyweight
                  ? profile?.body_weight_kg != null
                    ? unit
                    : undefined
                  : exercise.working_weight_kg != null
                    ? unit
                    : undefined
              }
              className={styles.workingValue}
              suffixClassName={styles.workingSuffix}
            />
          </div>
        </Card>

        {/* Summary tiles */}
        <div className={styles.statGrid}>
          <StatTile label={t("detail.sessions")} value={summary.sessions} />
          <StatTile label={t("detail.totalSets")} value={summary.totalSets} />
          {isBodyweight ? (
            <>
              <StatTile
                label={t("stats.totalReps")}
                value={summary.totalReps}
              />
              <StatTile
                label={t("detail.bestAddedLoad")}
                value={formatSignedWeight(summary.bestAddedLoadKg, unit)}
                suffix={
                  summary.bestAddedLoadKg != null ? unit : undefined
                }
              />
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Progress */}
        {!isBodyweight && chartPoints.length > 1 && (
          <Card variant="indigo" className={styles.chartCard}>
            <p className={styles.cardLabelOnGradient}>{t("detail.topSet")}</p>
            <ProgressChart points={chartPoints} unit={unit} />
          </Card>
        )}
        {isBodyweight && repsChartPoints.length > 1 && (
          <Card variant="indigo" className={styles.chartCard}>
            <p className={styles.cardLabelOnGradient}>{t("stats.reps")}</p>
            <ProgressChart points={repsChartPoints} unit="" />
          </Card>
        )}
        {isBodyweight && addedLoadChartPoints.length > 1 && (
          <Card variant="indigo" className={styles.chartCard}>
            <p className={styles.cardLabelOnGradient}>
              {t("detail.addedLoadProgress")}
            </p>
            <ProgressChart points={addedLoadChartPoints} unit={unit} signed />
          </Card>
        )}

        {/* Reps by weight */}
        {repStats.length > 0 && (
          <Card variant="surface" className={styles.tableCard}>
            <p className={styles.cardLabel}>
              {isBodyweight
                ? t("detail.repsByAddedLoad")
                : t("detail.repsByWeight")}
            </p>
            <RepsByWeightTable
              stats={repStats}
              unit={unit}
              loadLabel={
                isBodyweight ? t("stats.addedLoad") : undefined
              }
              signedLoad={isBodyweight}
            />
          </Card>
        )}

        {/* Recent history */}
        {recent.length > 0 && (
          <Card variant="surface" className={styles.tableCard}>
            <p className={styles.cardLabel}>{t("detail.recent")}</p>
            <div className={styles.recentList}>
              {recent.map((entry) => (
                <div key={entry.date + entry.sets![0]?.workoutId}>
                  <p className={styles.recentDate}>{formatDay(entry.date)}</p>
                  <div className={styles.recentSets}>
                    {entry.sets!.map((set, i) => (
                      <span
                        key={i}
                        className={styles.setChip}
                      >
                        <SetLoad
                          set={set}
                          unit={unit}
                          bodyweight={isBodyweight}
                        />
                        {set.to_failure && (
                          <IconFlame size={12} className={styles.setFlame} />
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
          <p className={styles.noSets}>{t("detail.noSets")}</p>
        )}
      </div>

      {!isBodyweight && (
        <WorkingWeightSheet
          open={weightSheetOpen}
          onClose={() => setWeightSheetOpen(false)}
          exerciseId={exercise.id}
          currentKg={exercise.working_weight_kg}
          unit={unit}
        />
      )}

      <EditExerciseSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        exercise={exercise}
        bodyweightModeLocked={
          exerciseUsage.isLoading ||
          exerciseUsage.isError ||
          exerciseUsage.data == null ||
          exerciseUsage.data > 0
        }
        onDeleted={() => router.push("/exercises")}
      />

      {!isBodyweight && (
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
      )}
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
    <div className={styles.statTile}>
      <p className={styles.statTileLabel}>{label}</p>
      <DotValue value={value} suffix={suffix} className={styles.statTileValue} />
    </div>
  );
}

function SetLoad({
  set,
  unit,
  bodyweight,
}: {
  set: ExerciseSetRecord;
  unit: "kg" | "lb";
  bodyweight: boolean;
}) {
  const total =
    set.weight_kg != null
      ? roundWeight(kgToUnit(set.weight_kg, unit))
      : null;

  if (
    bodyweight &&
    set.body_weight_kg != null &&
    set.weight_kg != null &&
    total != null
  ) {
    const base = roundWeight(kgToUnit(set.body_weight_kg, unit));
    const added = roundWeight(
      kgToUnit(set.weight_kg - set.body_weight_kg, unit),
    );
    return (
      <>
        <span className={styles.setValue}>{base}</span>
        <span className={styles.setX}>{added < 0 ? "−" : "+"}</span>
        <span className={styles.setValue}>{Math.abs(added)}</span>
        <span className={styles.setX}>=</span>
        <span className={styles.setValue}>{total}</span>
        <span className={styles.setUnit}>{unit}</span>
        <span className={styles.setX}>×</span>
        <span className={styles.setValue}>{set.reps ?? "—"}</span>
      </>
    );
  }

  return (
    <>
      <span className={styles.setValue}>{total ?? "—"}</span>
      {total != null && <span className={styles.setUnit}>{unit}</span>}
      <span className={styles.setX}>×</span>
      <span className={styles.setValue}>{set.reps ?? "—"}</span>
    </>
  );
}

function formatSignedWeight(valueKg: number | null, unit: "kg" | "lb") {
  if (valueKg == null) return "—";
  const value = roundWeight(kgToUnit(valueKg, unit));
  return value > 0 ? `+${value}` : value;
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
      <div className={styles.sheetStack}>
        <p className={styles.sheetHint}>{t("detail.workingWeightHint")}</p>
        <Field label={t("detail.weightUnit", { unit })}>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
            inputMode="decimal"
            placeholder="60"
            autoFocus
            className={styles.weightInput}
          />
        </Field>
        <Button
          variant="lime"
          size="lg"
          block
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
  bodyweightModeLocked,
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
  bodyweightModeLocked: boolean;
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
    if (
      bodyweightModeLocked &&
      (equipment === "bodyweight") !==
        (exercise.equipment === "bodyweight")
    ) {
      setError(t("detail.bodyweightModeLocked"));
      return;
    }
    update.mutate(
      {
        id: exercise.id,
        patch: {
          name: name.trim(),
          muscle_group_id: groupId,
          equipment,
          ...(equipment === "bodyweight"
            ? { working_weight_kg: null }
            : {}),
          machine_settings:
            equipment === "machine" ? machineSettings.trim() || null : null,
          unit: unitChoice === "default" ? null : unitChoice,
        },
      },
      {
        onSuccess: onClose,
        onError: (e) => {
          const message = (e as Error).message;
          setError(
            message.includes("Bodyweight mode cannot change")
              ? t("detail.bodyweightModeLocked")
              : message,
          );
        },
      },
    );
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={t("detail.editExercise")}>
        <div className={styles.sheetStack}>
          <Field label={t("picker.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("picker.muscleGroup")}>
            <div className={styles.chips}>
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
            <div className={styles.chips}>
              {EQUIPMENT_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  selected={equipment === option.value}
                  disabled={
                    bodyweightModeLocked &&
                    (option.value === "bodyweight") !==
                      (exercise.equipment === "bodyweight")
                  }
                  onClick={() => setEquipment(option.value)}
                >
                  {t(`equipment.${option.value}`)}
                </Chip>
              ))}
            </div>
            {bodyweightModeLocked && (
              <p className={styles.sheetHint}>
                {t("detail.bodyweightModeLocked")}
              </p>
            )}
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
            <div className={styles.chips}>
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
            block
            onClick={save}
            loading={update.isPending}
          >
            {t("common.saveChanges")}
          </Button>
          <Button
            variant="danger"
            block
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
