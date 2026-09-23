import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
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
  exerciseSummary,
  repsByWeight,
  useDeleteExerciseDetail,
  useUpdateExerciseDetail,
  type ExerciseSetRecord,
} from "../data/exercise-detail";
import { useI18n } from "../providers/locale-provider";
import { userErrorMessage } from "../lib/user-error";
import { formatDate } from "./format";
import { ErrorState, Header, LoadingState } from "./common";
import { ExerciseProgressForDetail } from "./progress-extras";

function signedWeight(valueKg: number | null, unit: Unit): string {
  if (valueKg == null) return "—";
  const value = roundWeight(kgToUnit(valueKg, unit));
  return value > 0 ? `+${value}` : String(value);
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {record.set_type === "warmup" ? <Text style={{ fontSize: 10, color: "#aeb8ff", fontFamily: fonts.bold }}>{t("set.warmupShort")}</Text> : null}
      <DotValue value={load} size={12} color={record.set_type === "warmup" ? "rgba(255,255,255,0.75)" : colors.text} />
      {total != null ? <Text style={{ fontSize: 10, color: colors.faint, marginLeft: -2 }}>{unit}</Text> : null}
      <Text variant="caption" tone="faint">×</Text>
      <DotValue value={record.reps ?? "—"} size={12} color={record.set_type === "warmup" ? "rgba(255,255,255,0.75)" : colors.text} />
      {record.to_failure ? <Ionicons name="flame-outline" size={12} color={colors.flame} /> : null}
    </View>
  );
}

function StatTile({ label, value, suffix }: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <Card radius={radii.tile} padding={14} style={{ flex: 1, minHeight: 91 }}>
      <Text variant="micro" tone="muted" numberOfLines={2} style={{ marginBottom: 6 }}>{label}</Text>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <DotValue value={value} suffix={suffix} size={24} />
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

export function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const exerciseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t, lang } = useI18n();
  const profileQuery = useProfile();
  const exercisesQuery = useExercises();
  const groupsQuery = useMuscleGroups();
  const workoutsQuery = useWorkouts();
  const update = useUpdateExerciseDetail();
  const remove = useDeleteExerciseDetail();
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
  const [editOpen, setEditOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [machineOpen, setMachineOpen] = useState(false);
  const [machineEditing, setMachineEditing] = useState(false);
  const [machineText, setMachineText] = useState("");
  const [machineError, setMachineError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [equipment, setEquipment] = useState<Equipment>("machine");
  const [weightDraft, setWeightDraft] = useState("");
  const [weightError, setWeightError] = useState<string | null>(null);
  const [machineSettings, setMachineSettings] = useState("");
  const [unitChoice, setUnitChoice] = useState<"default" | Unit>("default");
  const [editError, setEditError] = useState<string | null>(null);
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
    setMachineSettings(exercise.machine_settings ?? "");
    setEditError(null);
    setConfirmDelete(false);
    setEditOpen(true);
  }

  function openWeight() {
    setWeightDraft(exercise?.working_weight_kg == null ? "" : String(roundWeight(kgToUnit(exercise.working_weight_kg, unit))));
    setWeightError(null);
    setWeightOpen(true);
  }

  async function saveWeight() {
    if (!exercise) return;
    const parsed = parseWeight(weightDraft);
    setWeightError(null);
    try {
      await update.mutateAsync({
        id: exercise.id,
        patch: { working_weight_kg: parsed == null ? null : Math.round(unitToKg(parsed, unit) * 100) / 100 },
      });
      setWeightOpen(false);
    } catch (error) {
      setWeightError(userErrorMessage(t, error));
    }
  }

  async function deleteExercise() {
    if (!exercise) return;
    setEditError(null);
    try {
      await remove.mutateAsync(exercise.id);
      setEditOpen(false);
      router.replace("/library");
    } catch (error) {
      setEditError(userErrorMessage(t, error));
    }
  }

  function openPlates() {
    if (!exercise || exercise.working_weight_kg == null) return;
    router.push({
      pathname: "/plate-calculator",
      params: { weightKg: String(exercise.working_weight_kg), equipment: exercise.equipment, unit },
    });
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
    setUnitChoice(next);
  }

  async function saveEdit() {
    if (!exercise) return;
    if (!name.trim()) return setEditError(t("detail.nameEmpty"));
    if (used && (equipment === "bodyweight") !== (exercise.equipment === "bodyweight")) {
      return setEditError(t("detail.bodyweightModeLocked"));
    }
    setEditError(null);
    try {
      await update.mutateAsync({
        id: exercise.id,
        patch: {
          name: name.trim(),
          muscle_group_id: groupId,
          equipment,
          unit: unitChoice === "default" ? null : unitChoice,
          machine_settings: equipment === "machine" ? machineSettings.trim() || null : null,
          ...(equipment === "bodyweight" ? { working_weight_kg: null } : {}),
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

  const currentKg = bodyweight ? profileQuery.data?.body_weight_kg : exercise.working_weight_kg;
  const currentValue = currentKg == null ? "—" : roundWeight(kgToUnit(currentKg, unit));
  const bestLoad = bodyweight ? summary.bestAddedLoadKg : summary.bestWeightKg;

  return (
    <Screen bottomPadding={40}>
      <Header
        title={exercise.name}
        back
        action={<Button iconOnly size="compact" onPress={openEdit} accessibilityLabel={t("detail.editExercise")}><Ionicons name="create-outline" size={18} color={colors.muted} /></Button>}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11, marginBottom: 20 }}>
        {groupName ? <Tag tone="lime">{groupName}</Tag> : null}
        <Tag>{t(`equipment.${exercise.equipment}`)}</Tag>
        {exercise.unit && exercise.unit !== profileQuery.data?.unit
          ? <Tag tone="pink">{t("detail.inUnit", { unit: exercise.unit })}</Tag>
          : null}
        {exercise.equipment === "machine" ? (
          <Pressable onPress={openMachine} accessibilityRole="button" accessibilityLabel={t("machine.title")}
            style={{ height: 32, width: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="information" size={17} color={colors.lime} />
          </Pressable>
        ) : null}
      </View>

      <GradientCard variant="pink" padding={24} style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 15 }}>
          <Text tone="white" weight="medium" style={{ flex: 1, opacity: 0.84 }}>
            {bodyweight ? t("bodyWeight.title") : t("detail.currentWorking")}
          </Text>
          {!bodyweight ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {exercise.equipment !== "crossover" ? (
                <Pressable onPress={openPlates} disabled={currentKg == null} accessibilityRole="button" accessibilityLabel={t("set.plates")}
                  style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", opacity: currentKg == null ? 0.4 : 1, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="disc-outline" size={18} color={colors.white} />
                </Pressable>
              ) : null}
              <Pressable onPress={openWeight} accessibilityRole="button" accessibilityLabel={t("detail.editWorking")}
                style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="create-outline" size={17} color={colors.white} />
              </Pressable>
            </View>
          ) : null}
        </View>
        <DotValue value={currentValue} suffix={currentKg == null ? undefined : unit} size={57} color={colors.white} />
      </GradientCard>

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
            <ExerciseProgressForDetail
              exercise={exercise}
              workouts={workoutsQuery.data ?? []}
              profileUnit={profileQuery.data?.unit ?? "kg"}
              groupName={groupName}
            />
          </Card>

          {repStats.length > 0 ? (
            <Card padding={16} style={{ marginBottom: 20 }}>
              <Text tone="muted" weight="medium" style={{ marginBottom: 12 }}>
                {t(bodyweight ? "detail.repsByAddedLoad" : "detail.repsByWeight")}
              </Text>
              <View style={{ flexDirection: "row", paddingHorizontal: 4, marginBottom: 4 }}>
                {[bodyweight ? t("stats.addedLoad") : t("detail.weight"), t("detail.sets"), t("detail.avg"), t("detail.med"), t("detail.mode")].map((heading, index) => (
                  <Text key={index} variant="micro" tone="muted" numberOfLines={1}
                    style={{ flex: index === 0 ? 1.2 : 0.7, textAlign: index === 0 ? "left" : "center", fontSize: 10, letterSpacing: 0.3 }}>{heading}</Text>
                ))}
              </View>
              {repStats.map((row, index) => (
                <View key={row.weightKg} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, borderTopWidth: index ? 1 : 0, borderColor: "rgba(42,42,49,0.5)" }}>
                  <View style={{ flex: 1.2, flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <DotValue value={bodyweight ? signedWeight(row.weightKg, unit) : roundWeight(kgToUnit(row.weightKg, unit))} size={18} />
                    {row.failureRate > 0 ? <Ionicons name="flame-outline" size={13} color={colors.flame} style={{ opacity: 0.4 + row.failureRate * 0.6 }} /> : null}
                  </View>
                  {[row.setCount, row.avgReps, row.medianReps, row.modeReps].map((value, cellIndex) => (
                    <DotValue key={cellIndex} value={value} size={16} color={cellIndex === 0 ? colors.muted : colors.text}
                      style={{ flex: 0.7, textAlign: "center" }} />
                  ))}
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
                style={{ paddingTop: index ? 15 : 5, paddingBottom: 5 }}
              >
                <Text variant="caption" tone="muted" style={{ marginBottom: 9 }}>{formatDate(entry.date, lang)}</Text>
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
        open={weightOpen}
        onClose={() => setWeightOpen(false)}
        title={t("detail.workingWeight")}
        closeLabel={t("common.close")}
        footer={<Button variant="lime" block loading={update.isPending} onPress={saveWeight}>{t("common.save")}</Button>}
      >
        <Text tone="muted" style={{ fontSize: 14, lineHeight: 20, marginBottom: 16 }}>{t("detail.workingWeightHint")}</Text>
        <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>{t("detail.weightUnit", { unit })}</Text>
        <TextInput
          value={weightDraft}
          onChangeText={(value) => setWeightDraft(value.replace(/[^\d.,]/g, ""))}
          style={[inputStyle, { fontFamily: fonts.dot, fontSize: 25, textAlign: "center" }]}
          keyboardType="decimal-pad"
          placeholder="60"
          placeholderTextColor={colors.faint}
        />
        {weightError ? <Text tone="pink" style={{ marginBottom: 12 }}>{weightError}</Text> : null}
      </BottomSheet>

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
        <Text tone="muted" style={{ fontSize: 14, lineHeight: 20, marginBottom: 12 }}>{exercise.name}</Text>
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
          <View style={{ borderRadius: radii.tile, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised, padding: 16, marginBottom: 8 }}>
            <Text tone={exercise.machine_settings ? "primary" : "faint"} style={{ lineHeight: 24 }}>
              {exercise.machine_settings || t("machine.empty")}
            </Text>
          </View>
        )}
        {machineError ? <Text tone="pink" style={{ marginTop: 8 }}>{machineError}</Text> : null}
      </BottomSheet>

      <BottomSheet
        open={editOpen}
        onClose={() => { setEditOpen(false); setConfirmDelete(false); }}
        title={t(confirmDelete ? "detail.deleteTitle" : "detail.editExercise")}
        closeLabel={t("common.close")}
        footer={confirmDelete ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button variant="surface" style={{ flex: 1 }} onPress={() => setConfirmDelete(false)}>{t("common.cancel")}</Button>
            <Button variant="danger" style={{ flex: 1 }} loading={remove.isPending} onPress={deleteExercise}>{t("common.delete")}</Button>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Button variant="lime" block loading={update.isPending} onPress={saveEdit}>{t("common.saveChanges")}</Button>
            <Button variant="danger" block onPress={() => setConfirmDelete(true)}>{t("detail.deleteExercise")}</Button>
          </View>
        )}
      >
        {confirmDelete ? (
          <View style={{ paddingBottom: 12 }}>
            <Text tone="muted">{t("detail.deleteMessage")}</Text>
            {editError ? <Text tone="pink" style={{ marginTop: 12 }}>{editError}</Text> : null}
          </View>
        ) : (
        <>
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

        {editError ? <Text tone="pink" style={{ marginBottom: 12 }}>{editError}</Text> : null}
        </>
        )}
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
