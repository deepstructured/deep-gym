import { router, useLocalSearchParams } from "expo-router";
import { Fragment, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { EQUIPMENT_OPTIONS, type Equipment } from "@deepgym/core/workout";
import {
  kgToUnit,
  parseWeight,
  roundWeight,
  unitToKg,
  type Unit,
} from "@deepgym/core/weight";
import { colors, fonts, radii } from "../theme";
import { BottomSheet, Button, Card, Chip, DotValue, GradientCard, Screen, Text } from "../ui";
import { useExercises, useMuscleGroups, useProfile, useWorkouts } from "../data/queries";
import {
  exerciseHistory,
  exerciseProgress,
  exerciseSummary,
  repsByWeight,
  useUpdateExerciseDetail,
  type ExerciseSetRecord,
  type ProgressMetric,
  type ProgressPoint,
} from "../data/exercise-detail";
import { useI18n } from "../providers/locale-provider";
import { userErrorMessage } from "../lib/user-error";
import { formatDate, localISO } from "./format";
import { ErrorState, Header, LoadingState } from "./common";

type Period = "1m" | "3m" | "6m" | "1y" | "all";

const PERIODS = [
  { value: "1m", label: "period.1m" },
  { value: "3m", label: "period.3m" },
  { value: "6m", label: "period.6m" },
  { value: "1y", label: "period.1y" },
  { value: "all", label: "period.all" },
] as const;

function periodStart(period: Period): string | null {
  if (period === "all") return null;
  const date = new Date();
  if (period === "1y") date.setFullYear(date.getFullYear() - 1);
  else date.setMonth(date.getMonth() - Number(period[0]));
  return localISO(date);
}

function signedWeight(valueKg: number | null, unit: Unit): string {
  if (valueKg == null) return "—";
  const value = roundWeight(kgToUnit(valueKg, unit));
  return value > 0 ? `+${value}` : String(value);
}

function metricValue(value: number, metric: ProgressMetric, unit: Unit): string {
  if (metric === "reps") return String(Math.round(value));
  const converted = roundWeight(kgToUnit(value, unit));
  return metric === "addedLoad" && converted > 0 ? `+${converted}` : String(converted);
}

function SetLabel({ record, unit, bodyweight }: {
  record: ExerciseSetRecord;
  unit: Unit;
  bodyweight: boolean;
}) {
  const { t } = useI18n();
  const total = record.weight_kg == null ? null : roundWeight(kgToUnit(record.weight_kg, unit));
  const base = record.body_weight_kg == null
    ? null
    : roundWeight(kgToUnit(record.body_weight_kg, unit));
  const added = record.weight_kg == null || record.body_weight_kg == null
    ? null
    : roundWeight(kgToUnit(record.weight_kg - record.body_weight_kg, unit));
  const load = bodyweight && total != null && base != null && added != null
    ? `${base}${added < 0 ? "−" : "+"}${Math.abs(added)}=${total}`
    : total == null ? "—" : String(total);
  return (
    <Text variant="caption" tone={record.set_type === "warmup" ? "muted" : "primary"}>
      {record.set_type === "warmup" ? `${t("set.warmupShort")}  ` : ""}
      {load}{total == null ? "" : ` ${unit}`} × {record.reps ?? "—"}{record.to_failure ? "  🔥" : ""}
    </Text>
  );
}

function StatTile({ label, value, suffix }: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <Card variant="stat" radius={20} padding={15} style={{ flex: 1, minHeight: 94 }}>
      <Text variant="micro" tone="muted" numberOfLines={2}>{label}</Text>
      <View style={{ flex: 1, justifyContent: "flex-end", paddingTop: 8 }}>
        <DotValue value={value} suffix={suffix} size={28} />
      </View>
    </Card>
  );
}

function Tag({ children, tone = "muted" }: {
  children: string;
  tone?: "muted" | "lime" | "pink";
}) {
  return (
    <View style={{
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: tone === "lime" ? "rgba(215,246,81,0.28)" : tone === "pink" ? "rgba(245,103,181,0.3)" : colors.line,
      backgroundColor: tone === "lime" ? "rgba(215,246,81,0.09)" : tone === "pink" ? "rgba(245,103,181,0.09)" : colors.raised,
      paddingHorizontal: 11,
      paddingVertical: 6,
    }}>
      <Text variant="caption" tone={tone}>{children}</Text>
    </View>
  );
}

function ProgressChart({ points, selectedIndex, onSelect }: {
  points: ProgressPoint[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const [width, setWidth] = useState(300);
  const chartHeight = 166;
  const left = 13;
  const right = width - 13;
  const top = 15;
  const bottom = chartHeight - 16;
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spread = Math.max(maxValue - minValue, Math.abs(maxValue) * 0.08, 1);
  const floor = minValue - spread * 0.1;
  const ceiling = maxValue + spread * 0.1;
  const coords = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : left + (index / (points.length - 1)) * (right - left),
    y: bottom - ((point.value - floor) / (ceiling - floor)) * (bottom - top),
  }));
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
  const area = coords.length > 1
    ? `${line} L${coords[coords.length - 1].x} ${bottom} L${coords[0].x} ${bottom} Z`
    : "";

  function onLayout(event: LayoutChangeEvent) {
    setWidth(Math.max(100, event.nativeEvent.layout.width));
  }

  return (
    <View onLayout={onLayout}>
      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${width} ${chartHeight}`}>
        <Line x1={left} y1={bottom} x2={right} y2={bottom} stroke={colors.line} strokeWidth={1} />
        {area ? <Path d={area} fill="rgba(215,246,81,0.075)" /> : null}
        {points.length > 1 ? <Path d={line} fill="none" stroke={colors.lime} strokeWidth={2.5} /> : null}
        {coords.map((point, index) => (
          <Fragment key={`${points[index].date}-${index}`}>
            <Circle
              cx={point.x}
              cy={point.y}
              r={index === selectedIndex ? 6 : 4}
              fill={index === selectedIndex ? colors.lime : colors.surface}
              stroke={colors.lime}
              strokeWidth={2}
            />
            <Circle cx={point.x} cy={point.y} r={18} fill="transparent" onPress={() => onSelect(index)} />
          </Fragment>
        ))}
      </Svg>
    </View>
  );
}

export function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const exerciseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t, lang } = useI18n();
  const profileQuery = useProfile();
  const exercisesQuery = useExercises();
  const groupsQuery = useMuscleGroups();
  const workoutsQuery = useWorkouts();
  const update = useUpdateExerciseDetail();
  const exercise = exercisesQuery.data?.find((item) => item.id === exerciseId);
  const unit: Unit = exercise?.unit ?? profileQuery.data?.unit ?? "kg";
  const bodyweight = exercise?.equipment === "bodyweight";
  const groupName = groupsQuery.data?.find((group) => group.id === exercise?.muscle_group_id)?.name;
  const records = useMemo(
    () => exerciseHistory(workoutsQuery.data ?? [], exerciseId ?? ""),
    [workoutsQuery.data, exerciseId],
  );
  const summary = useMemo(() => exerciseSummary(records, bodyweight), [records, bodyweight]);
  const repStats = useMemo(() => repsByWeight(records, bodyweight), [records, bodyweight]);
  const [metric, setMetric] = useState<ProgressMetric>("topSet");
  const [period, setPeriod] = useState<Period>("3m");
  const [selected, setSelected] = useState<number | null>(null);
  const activeMetric = bodyweight && metric !== "reps" && metric !== "addedLoad" ? "reps" : metric;
  const allPoints = useMemo(() => exerciseProgress(records, activeMetric), [records, activeMetric]);
  const since = periodStart(period);
  const points = since ? allPoints.filter((point) => point.date >= since) : allPoints;
  const selectedIndex = selected != null && selected < points.length ? selected : points.length - 1;
  const activePoint = points[selectedIndex];
  const [editOpen, setEditOpen] = useState(false);
  const [machineOpen, setMachineOpen] = useState(false);
  const [machineEditing, setMachineEditing] = useState(false);
  const [machineText, setMachineText] = useState("");
  const [machineError, setMachineError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [equipment, setEquipment] = useState<Equipment>("machine");
  const [weight, setWeight] = useState("");
  const [machineSettings, setMachineSettings] = useState("");
  const [unitChoice, setUnitChoice] = useState<"default" | Unit>("default");
  const [editError, setEditError] = useState<string | null>(null);
  const editUnit: Unit = unitChoice === "default" ? profileQuery.data?.unit ?? "kg" : unitChoice;
  const used = (workoutsQuery.data ?? []).some((workout) =>
    workout.workout_exercises.some((occurrence) => occurrence.exercise_id === exerciseId),
  );

  const recent = useMemo(() => {
    const byWorkout = new Map<string, { workoutId: string; date: string; sets: ExerciseSetRecord[] }>();
    for (const record of records) {
      const entry = byWorkout.get(record.workoutId) ?? {
        workoutId: record.workoutId,
        date: record.workoutDate,
        sets: [],
      };
      entry.sets.push(record);
      byWorkout.set(record.workoutId, entry);
    }
    return [...byWorkout.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [records]);

  function openEdit() {
    if (!exercise) return;
    setName(exercise.name);
    setGroupId(exercise.muscle_group_id);
    setEquipment(exercise.equipment);
    setUnitChoice(exercise.unit ?? "default");
    setWeight(exercise.working_weight_kg == null ? "" : String(roundWeight(kgToUnit(exercise.working_weight_kg, unit))));
    setMachineSettings(exercise.machine_settings ?? "");
    setEditError(null);
    setEditOpen(true);
  }

  function openMachine() {
    setMachineText(exercise?.machine_settings ?? "");
    setMachineError(null);
    setMachineEditing(false);
    setMachineOpen(true);
  }

  async function saveMachine() {
    if (!exercise) return;
    setMachineError(null);
    try {
      await update.mutateAsync({
        id: exercise.id,
        patch: { machine_settings: machineText.trim() || null },
      });
      setMachineEditing(false);
    } catch (error) {
      setMachineError(userErrorMessage(t, error));
    }
  }

  function chooseUnit(next: "default" | Unit) {
    const nextUnit = next === "default" ? profileQuery.data?.unit ?? "kg" : next;
    const parsed = parseWeight(weight);
    if (parsed != null && nextUnit !== editUnit) {
      setWeight(String(roundWeight(kgToUnit(unitToKg(parsed, editUnit), nextUnit))));
    }
    setUnitChoice(next);
  }

  async function saveEdit() {
    if (!exercise) return;
    if (!name.trim()) return setEditError(t("detail.nameEmpty"));
    if (used && (equipment === "bodyweight") !== (exercise.equipment === "bodyweight")) {
      return setEditError(t("detail.bodyweightModeLocked"));
    }
    setEditError(null);
    const parsed = parseWeight(weight);
    try {
      await update.mutateAsync({
        id: exercise.id,
        patch: {
          name: name.trim(),
          muscle_group_id: groupId,
          equipment,
          unit: unitChoice === "default" ? null : unitChoice,
          machine_settings: equipment === "machine" ? machineSettings.trim() || null : null,
          working_weight_kg: equipment === "bodyweight" || parsed == null
            ? null
            : Math.round(unitToKg(parsed, editUnit) * 100) / 100,
        },
      });
      setEditOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setEditError(message.includes("Bodyweight mode cannot change")
        ? t("detail.bodyweightModeLocked")
        : userErrorMessage(t, error));
    }
  }

  const loading = exercisesQuery.isLoading || profileQuery.isLoading;
  const historyLoading = workoutsQuery.isLoading;
  if (loading) {
    return <Screen><Header title={t("detail.title")} back /><LoadingState /></Screen>;
  }
  if (exercisesQuery.error || !exercise) {
    return (
      <Screen>
        <Header title={t("detail.title")} back />
        <ErrorState message={exercisesQuery.error?.message ?? t("common.error")} retry={() => exercisesQuery.refetch()} />
      </Screen>
    );
  }

  const metricOptions: ProgressMetric[] = bodyweight
    ? ["reps", "addedLoad"]
    : ["topSet", "oneRm", "volume", "reps"];
  const currentKg = bodyweight ? profileQuery.data?.body_weight_kg : exercise.working_weight_kg;
  const currentValue = currentKg == null ? "—" : roundWeight(kgToUnit(currentKg, unit));
  const bestLoad = bodyweight ? summary.bestAddedLoadKg : summary.bestWeightKg;

  return (
    <Screen bottomPadding={40}>
      <Header
        title={exercise.name}
        back
        action={<Button iconOnly size="sm" onPress={openEdit} accessibilityLabel={t("detail.editExercise")}>✎</Button>}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11, marginBottom: 20 }}>
        {groupName ? <Tag tone="lime">{groupName}</Tag> : null}
        <Tag>{t(`equipment.${exercise.equipment}`)}</Tag>
        {exercise.unit && exercise.unit !== profileQuery.data?.unit
          ? <Tag tone="pink">{t("detail.inUnit", { unit: exercise.unit })}</Tag>
          : null}
        {exercise.equipment === "machine" ? (
          <Pressable onPress={openMachine} accessibilityRole="button" accessibilityLabel={t("machine.title")}>
            <Tag>{t("machine.title")}</Tag>
          </Pressable>
        ) : null}
      </View>

      <GradientCard variant="pink" padding={24} style={{ marginBottom: 13 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 15 }}>
          <Text tone="white" weight="medium" style={{ flex: 1, opacity: 0.84 }}>
            {bodyweight ? t("bodyWeight.title") : t("detail.currentWorking")}
          </Text>
          {!bodyweight ? (
            <Button iconOnly size="sm" variant="surface" onPress={openEdit} accessibilityLabel={t("detail.editWorking")}>✎</Button>
          ) : null}
        </View>
        <DotValue value={currentValue} suffix={currentKg == null ? undefined : unit} size={57} color={colors.white} />
      </GradientCard>
      {!bodyweight ? (
        <Button variant="surface" block style={{ marginBottom: 14 }} onPress={() => router.push({
          pathname: "/plate-calculator",
          params: {
            ...(currentKg != null ? { weightKg: String(currentKg) } : {}),
            equipment: exercise.equipment,
            unit,
          },
        })}>
          {t("settings.plateCalc")}
        </Button>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <StatTile label={t("detail.sessions")} value={historyLoading ? "…" : summary.sessions} />
        <StatTile label={t("detail.totalSets")} value={historyLoading ? "…" : summary.totalSets} />
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 22 }}>
        {bodyweight ? (
          <>
            <StatTile label={t("stats.totalReps")} value={historyLoading ? "…" : summary.totalReps} />
            <StatTile
              label={t("detail.bestAddedLoad")}
              value={historyLoading ? "…" : signedWeight(bestLoad, unit)}
              suffix={bestLoad == null ? undefined : unit}
            />
          </>
        ) : (
          <>
            <StatTile
              label={t("detail.bestWeight")}
              value={historyLoading ? "…" : bestLoad == null ? "—" : roundWeight(kgToUnit(bestLoad, unit))}
              suffix={bestLoad == null ? undefined : unit}
            />
            <StatTile
              label={t("detail.est1rm")}
              value={historyLoading ? "…" : summary.estOneRepMaxKg == null ? "—" : roundWeight(kgToUnit(summary.estOneRepMaxKg, unit))}
              suffix={summary.estOneRepMaxKg == null ? undefined : unit}
            />
          </>
        )}
      </View>

      {workoutsQuery.error ? <ErrorState message={workoutsQuery.error.message} retry={() => workoutsQuery.refetch()} /> : null}
      {historyLoading ? <LoadingState /> : null}

      {!historyLoading && !workoutsQuery.error && records.length > 0 ? (
        <>
          <Card padding={16} style={{ marginBottom: 20 }}>
            <Text tone="muted" weight="medium" style={{ marginBottom: 14 }}>{t("home.progress")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingBottom: 13 }}>
              {metricOptions.map((option) => (
                <Chip key={option} selected={activeMetric === option} onPress={() => { setMetric(option); setSelected(null); }}>
                  {t(`stats.metric.${option}`)}
                </Chip>
              ))}
            </ScrollView>
            <Text variant="caption" tone="muted" style={{ marginBottom: 14 }}>
              {t(`stats.caption.${activeMetric}`)}
            </Text>
            {activePoint ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                <DotValue
                  value={metricValue(activePoint.value, activeMetric, unit)}
                  suffix={activeMetric === "reps" ? undefined : unit}
                  size={35}
                />
                <Text variant="caption" tone="muted">{formatDate(activePoint.date, lang)}</Text>
              </View>
            ) : null}
            {points.length ? (
              <ProgressChart points={points} selectedIndex={selectedIndex} onSelect={setSelected} />
            ) : (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <Text tone="muted">{t("stats.emptyPeriod")}</Text>
                <Button variant="ghost" size="sm" onPress={() => setPeriod("all")}>{t("stats.showAllTime")}</Button>
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, marginTop: 10 }}>
              {PERIODS.map((option) => (
                <Chip key={option.value} selected={period === option.value} onPress={() => { setPeriod(option.value); setSelected(null); }}>
                  {t(option.label)}
                </Chip>
              ))}
            </ScrollView>
            {activePoint ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderColor: colors.line }}>
                <Text variant="caption" tone="muted">{t("stats.latest")}: {metricValue(points[points.length - 1].value, activeMetric, unit)}</Text>
                <Text variant="caption" tone="lime">{t("stats.best")}: {metricValue(Math.max(...points.map((point) => point.value)), activeMetric, unit)}</Text>
              </View>
            ) : null}
          </Card>

          {repStats.length > 0 ? (
            <Card padding={16} style={{ marginBottom: 20 }}>
              <Text tone="muted" weight="medium" style={{ marginBottom: 12 }}>
                {t(bodyweight ? "detail.repsByAddedLoad" : "detail.repsByWeight")}
              </Text>
              {repStats.slice(0, 8).map((row, index) => (
                <View key={row.weightKg} style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 11,
                  borderTopWidth: index ? 1 : 0,
                  borderColor: colors.line,
                }}>
                  <View style={{ width: 82 }}>
                    <Text weight="semibold" tone="lime">{bodyweight ? signedWeight(row.weightKg, unit) : roundWeight(kgToUnit(row.weightKg, unit))} {unit}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" tone="muted">{t("detail.avg")} {row.avgReps} · {t("detail.med")} {row.medianReps}</Text>
                  </View>
                  <Text variant="caption" tone="muted">{row.setCount} {t("detail.sets").toLowerCase()}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          <Card padding={16} style={{ marginBottom: 20 }}>
            <Text tone="muted" weight="medium" style={{ marginBottom: 10 }}>{t("detail.recent")}</Text>
            {recent.map((entry, index) => (
              <Pressable
                key={entry.workoutId}
                onPress={() => router.push({ pathname: "/workouts/[id]", params: { id: entry.workoutId } })}
                style={{ paddingVertical: 11, borderTopWidth: index ? 1 : 0, borderColor: colors.line }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text variant="caption" tone="muted">{formatDate(entry.date, lang)}</Text>
                  <Text variant="caption" tone="faint">›</Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {entry.sets.map((record, setIndex) => (
                    <View key={`${record.position}-${setIndex}`} style={{
                      borderRadius: radii.pill,
                      borderWidth: 1,
                      borderColor: record.set_type === "warmup" ? "rgba(64,84,214,0.4)" : colors.line,
                      backgroundColor: record.set_type === "warmup" ? "rgba(24,39,136,0.25)" : colors.raised,
                      paddingHorizontal: 9,
                      paddingVertical: 5,
                    }}>
                      <SetLabel record={record} unit={unit} bodyweight={bodyweight} />
                    </View>
                  ))}
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      {!historyLoading && !workoutsQuery.error && records.length === 0 ? (
        <Card><Text tone="muted" style={{ textAlign: "center" }}>{t("detail.noSets")}</Text></Card>
      ) : null}

      <BottomSheet
        open={machineOpen}
        onClose={() => setMachineOpen(false)}
        title={t("machine.title")}
        closeLabel={t("common.close")}
        footer={machineEditing ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button variant="surface" style={{ flex: 1 }} onPress={() => { setMachineEditing(false); setMachineText(exercise.machine_settings ?? ""); }}>
              {t("common.cancel")}
            </Button>
            <Button variant="lime" style={{ flex: 1 }} loading={update.isPending} onPress={saveMachine}>
              {t("common.save")}
            </Button>
          </View>
        ) : (
          <Button variant="surface" block onPress={() => setMachineEditing(true)}>
            {exercise.machine_settings ? t("machine.edit") : t("machine.add")}
          </Button>
        )}
      >
        <Text weight="semibold" style={{ marginBottom: 14 }}>{exercise.name}</Text>
        {machineEditing ? (
          <TextInput
            value={machineText}
            onChangeText={setMachineText}
            style={[inputStyle, { minHeight: 116, textAlignVertical: "top", marginBottom: 0 }]}
            multiline
            placeholder={t("machine.placeholder")}
            placeholderTextColor={colors.faint}
          />
        ) : (
          <Text tone="muted" style={{ marginBottom: 8 }}>
            {exercise.machine_settings || t("machine.empty")}
          </Text>
        )}
        {machineError ? <Text tone="pink" style={{ marginTop: 8 }}>{machineError}</Text> : null}
      </BottomSheet>

      <BottomSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t("detail.editExercise")}
        closeLabel={t("common.close")}
        footer={<Button variant="lime" block loading={update.isPending} onPress={saveEdit}>{t("common.saveChanges")}</Button>}
      >
        <Text variant="micro" tone="muted" style={{ marginBottom: 7 }}>{t("picker.name")}</Text>
        <TextInput value={name} onChangeText={setName} style={inputStyle} placeholder={t("picker.namePlaceholder")} placeholderTextColor={colors.faint} />

        <Text variant="micro" tone="muted" style={{ marginBottom: 9 }}>{t("picker.muscleGroup")}</Text>
        <View style={chipWrap}>
          {(groupsQuery.data ?? []).map((group) => (
            <Chip key={group.id} selected={groupId === group.id} onPress={() => setGroupId(group.id)}>{group.name}</Chip>
          ))}
        </View>

        <Text variant="micro" tone="muted" style={{ marginBottom: 9 }}>{t("picker.equipment")}</Text>
        <View style={chipWrap}>
          {EQUIPMENT_OPTIONS.map(({ value }) => (
            <Chip
              key={value}
              selected={equipment === value}
              disabled={used && (value === "bodyweight") !== (exercise.equipment === "bodyweight")}
              onPress={() => setEquipment(value)}
            >
              {t(`equipment.${value}`)}
            </Chip>
          ))}
        </View>
        {used ? <Text variant="caption" tone="muted" style={{ marginTop: -9, marginBottom: 15 }}>{t("detail.bodyweightModeLocked")}</Text> : null}

        {equipment === "machine" ? (
          <>
            <Text variant="micro" tone="muted" style={{ marginBottom: 7 }}>{t("detail.machineSetup")}</Text>
            <TextInput
              value={machineSettings}
              onChangeText={setMachineSettings}
              style={[inputStyle, { minHeight: 94, textAlignVertical: "top" }]}
              multiline
              placeholder={t("picker.machineSetupPlaceholder")}
              placeholderTextColor={colors.faint}
            />
          </>
        ) : null}

        <Text variant="micro" tone="muted" style={{ marginBottom: 9 }}>{t("picker.unitForExercise")}</Text>
        <View style={chipWrap}>
          <Chip selected={unitChoice === "default"} onPress={() => chooseUnit("default")}>{t("picker.unitDefault", { unit: profileQuery.data?.unit ?? "kg" })}</Chip>
          <Chip selected={unitChoice === "kg"} onPress={() => chooseUnit("kg")}>kg</Chip>
          <Chip selected={unitChoice === "lb"} onPress={() => chooseUnit("lb")}>lb</Chip>
        </View>

        {equipment !== "bodyweight" ? (
          <>
            <Text variant="micro" tone="muted" style={{ marginBottom: 7 }}>{t("detail.weightUnit", { unit: editUnit })}</Text>
            <TextInput
              value={weight}
              onChangeText={(value) => setWeight(value.replace(/[^\d.,]/g, ""))}
              style={[inputStyle, { fontFamily: fonts.dot, fontSize: 25, textAlign: "center" }]}
              keyboardType="decimal-pad"
              placeholder="60"
              placeholderTextColor={colors.faint}
            />
          </>
        ) : null}
        {editError ? <Text tone="pink" style={{ marginBottom: 12 }}>{editError}</Text> : null}
      </BottomSheet>
    </Screen>
  );
}

const chipWrap = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginBottom: 18 };
const inputStyle = {
  backgroundColor: colors.raised,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: radii.medium,
  paddingHorizontal: 14,
  minHeight: 50,
  color: colors.text,
  fontFamily: fonts.regular,
  fontSize: 15,
  marginBottom: 18,
};
