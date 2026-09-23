import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import type { Exercise } from "@deepgym/core/types";
import { BASE_WORKOUT_TYPES } from "@deepgym/core/workout";
import { formatWeight, kgToUnit, parseSignedWeight, parseWeight, roundWeight, unitToKg } from "@deepgym/core/weight";
import { colors, fonts, radii } from "../theme";
import { BottomSheet, Button, Card, Chip, Screen, Text } from "../ui";
import { createDraftSet, exerciseToDraft, type DraftExercise, type WorkoutDraft } from "../data/draft";
import { bodyweightDraftError, draftToInput } from "../data/draft-convert";
import { useUpdateExerciseDetail } from "../data/exercise-detail";
import { useDeleteWorkout, useExercises, useMuscleGroups, useProfile, useWorkout, useWorkouts } from "../data/queries";
import { useUpdateWorkout, workoutToEditDraft } from "../data/workout-edit";
import { workoutRpcErrorKey } from "../data/workout-rpc";
import { useI18n } from "../providers/locale-provider";
import { userErrorMessage } from "../lib/user-error";
import { ErrorState, Header, LoadingState } from "./common";
import { InlineExerciseCreate } from "./inline-exercise-create";
import { localISO } from "./format";
import { SortableWorkoutExercises } from "./sortable-workout-exercises";
import { WorkoutBodyweightLoad } from "./workout-bodyweight-load";
import { WorkoutCompareChip } from "./workout-compare-chip";
import { WorkoutConfirmSheet } from "./workout-confirm-sheet";
import { WorkoutExerciseHeader } from "./workout-exercise-header";
import { WorkoutGlyph } from "./workout-glyphs";
import { WorkoutPlateSheet, type WorkoutPlateContext } from "./workout-plate-sheet";
import { withWarmupSet } from "./workout-warmup";

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return localISO(new Date(year, month - 1, day)) === value;
}

function pickerDate(value: string): Date {
  if (!isValidDate(value)) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function inputDateLabel(value: string): string {
  if (!isValidDate(value)) return value;
  return pickerDate(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function draftBodyWeightKg(draft: WorkoutDraft, defaultUnit: "kg" | "lb"): number | null {
  const value = parseWeight(draft.bodyWeight);
  return value == null ? null : unitToKg(value, draft.bodyWeightUnit ?? defaultUnit);
}

export function WorkoutEditScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t, lang } = useI18n();
  const query = useWorkout(id ?? "");
  const profile = useProfile();
  const groups = useMuscleGroups();
  const exercises = useExercises();
  const history = useWorkouts();
  const update = useUpdateWorkout();
  const updateMachine = useUpdateExerciseDetail();
  const remove = useDeleteWorkout();
  const initializedFor = useRef<string | null>(null);
  const workoutScrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const [storedDraft, setDraft] = useState<WorkoutDraft | null>(null);
  const draft = initializedFor.current === id ? storedDraft : null;
  const [exercisePicker, setExercisePicker] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null);
  const [exerciseTool, setExerciseTool] = useState<{ key: string; kind: "compare" | "machine" } | null>(null);
  const [plateContext, setPlateContext] = useState<WorkoutPlateContext | null>(null);
  const [compareDay, setCompareDay] = useState<string | null>(null);
  const [compareCalendarOpen, setCompareCalendarOpen] = useState(false);
  const [compareMonth, setCompareMonth] = useState(localISO().slice(0, 7));
  const [machineEditing, setMachineEditing] = useState(false);
  const [machineText, setMachineText] = useState("");
  const [machineError, setMachineError] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const unit = profile.data?.unit ?? "kg";
  const groupNames = useMemo(
    () => new Map((groups.data ?? []).map((group) => [group.id, group.name])),
    [groups.data],
  );
  const exerciseById = useMemo(() => new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise])), [exercises.data]);
  const toolExercise = draft?.exercises.find((entry) => entry.key === exerciseTool?.key);
  const liveMachineSettings = toolExercise
    ? exercises.data?.find((exercise) => exercise.id === toolExercise.exerciseId)?.machine_settings ?? toolExercise.machineSettings
    : null;
  const comparisonSessions = toolExercise && draft
    ? (history.data ?? []).filter((workout) => workout.date < draft.date)
      .flatMap((workout) => workout.workout_exercises
        .filter((entry) => entry.exercise_id === toolExercise.exerciseId)
        .map((entry) => ({ workout, entry })))
      .sort((a, b) => b.workout.date.localeCompare(a.workout.date))
    : [];
  const compareDates = [...new Set(comparisonSessions.map(({ workout }) => workout.date))];
  const activeCompareDay = compareDay ?? compareDates[0];
  const selectedHistory = comparisonSessions.filter(({ workout }) => workout.date === activeCompareDay);
  const [compareYear, compareMonthNumber] = compareMonth.split("-").map(Number);
  const compareMonthDate = new Date(compareYear, compareMonthNumber - 1, 1, 12);
  const calendarOffset = (compareMonthDate.getDay() + 6) % 7;
  const daysInCompareMonth = new Date(compareYear, compareMonthNumber, 0).getDate();
  const calendarCells = Array.from({ length: Math.ceil((calendarOffset + daysInCompareMonth) / 7) * 7 }, (_, index) => index - calendarOffset + 1);
  const availableCompareDates = new Set(compareDates);

  function shiftCompareMonth(step: -1 | 1) {
    setCompareMonth(localISO(new Date(compareYear, compareMonthNumber - 1 + step, 1, 12)).slice(0, 7));
  }

  function openCompare(exercise: DraftExercise) {
    setCompareDay(null);
    setCompareCalendarOpen(false);
    setExerciseTool({ key: exercise.key, kind: "compare" });
  }

  function openPlates(exercise: DraftExercise, rawWeight: string) {
    const weight = parseWeight(rawWeight);
    if (weight == null) return;
    setPlateContext({ weightKg: unitToKg(weight, exercise.unit), equipment: exercise.equipment, unit: exercise.unit });
  }

  function openMachine(exercise: DraftExercise) {
    setMachineText(exercises.data?.find((item) => item.id === exercise.exerciseId)?.machine_settings ?? exercise.machineSettings ?? "");
    setMachineEditing(false);
    setMachineError(null);
    setExerciseTool({ key: exercise.key, kind: "machine" });
  }

  function closeExerciseTool() {
    if (updateMachine.isPending) return;
    setExerciseTool(null);
    setMachineEditing(false);
    setMachineError(null);
  }

  async function saveMachine() {
    if (!toolExercise || updateMachine.isPending) return;
    setMachineError(null);
    const settings = machineText.trim() || null;
    try {
      await updateMachine.mutateAsync({ id: toolExercise.exerciseId, patch: { machine_settings: settings } });
      updateExercise(toolExercise.key, (current) => ({ ...current, machineSettings: settings }));
      setMachineEditing(false);
    } catch (failure) {
      setMachineError(userErrorMessage(t, failure));
    }
  }

  function closeExercisePicker() {
    setExercisePicker(false);
    setCreatingExercise(false);
    setPickerSearch("");
  }

  useEffect(() => {
    if (!query.data || !profile.data || groups.isLoading || !id) return;
    if (initializedFor.current === id) return;
    setDraft(workoutToEditDraft(query.data, groupNames, profile.data.unit));
    initializedFor.current = id;
    setError(null);
  }, [query.data, profile.data, groups.isLoading, groupNames, id]);

  function patch(change: (current: WorkoutDraft) => WorkoutDraft) {
    setDraft((current) => current ? change(current) : current);
  }

  function updateExercise(key: string, change: (entry: DraftExercise) => DraftExercise) {
    patch((current) => ({
      ...current,
      exercises: current.exercises.map((entry) => entry.key === key ? change(entry) : entry),
    }));
  }

  function moveExercise(from: number, to: number) {
    patch((current) => {
      if (from < 0 || to < 0 || from >= current.exercises.length || to >= current.exercises.length) return current;
      const next = [...current.exercises];
      const [entry] = next.splice(from, 1);
      next.splice(to, 0, entry);
      return { ...current, exercises: next };
    });
  }

  function chooseExercise(exercise: Exercise) {
    if (!draft) return;
    const snapshot = parseWeight(draft.bodyWeight);
    const bodyWeightKg = snapshot == null
      ? null
      : unitToKg(snapshot, draft.bodyWeightUnit ?? unit);
    const entry = exerciseToDraft(
      exercise,
      groupNames.get(exercise.muscle_group_id) ?? "",
      unit,
      bodyWeightKg,
    );
    patch((current) => ({ ...current, exercises: [...current.exercises, entry] }));
    closeExercisePicker();
  }

  async function save() {
    if (!draft || !id || update.isPending || remove.isPending) return;
    setError(null);
    if (!isValidDate(draft.date)) return setError(t("workout.invalidDate"));
    if (draft.exercises.length === 0) return setError(t("workout.addExercise"));
    const bodyweightIssue = bodyweightDraftError(draft, unit);
    if (bodyweightIssue) {
      setError(bodyweightIssue === "missing-body-weight"
        ? t("bodyWeight.requiredForAddedLoad")
        : bodyweightIssue === "nonpositive-total"
          ? t("bodyWeight.invalidTotalLoad")
          : t("bodyWeight.invalidAddedLoad"));
      return;
    }
    try {
      await update.mutateAsync({ id, input: draftToInput(draft, unit) });
      router.replace({ pathname: "/workouts/[id]", params: { id } });
    } catch (failure) {
      const key = workoutRpcErrorKey(failure);
      setError(key ? t(key) : userErrorMessage(t, failure));
    }
  }

  function confirmDelete() {
    if (!id || update.isPending || remove.isPending) return;
    setConfirmDeleteOpen(true);
  }

  const pickerResults = (exercises.data ?? []).filter((exercise) =>
    (!pickerGroupId || exercise.muscle_group_id === pickerGroupId) &&
    exercise.name.toLocaleLowerCase().includes(pickerSearch.trim().toLocaleLowerCase()),
  );
  const canSave = Boolean(draft?.exercises.length) && !update.isPending && !remove.isPending;

  return (
    <Screen
      bottomPadding={48}
      scrollEnabled={!reordering}
      scrollRef={workoutScrollRef}
      scrollEventThrottle={16}
      onScroll={(event) => { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
    >
      <Header
        title={t("workout.edit")}
        back
        action={<Button variant="lime" size="sm" disabled={!canSave} loading={update.isPending} onPress={save}>{t("common.save")}</Button>}
      />

      {query.isLoading || profile.isLoading || groups.isLoading || !draft && !query.error
        ? <LoadingState /> : null}
      {query.error || profile.error ? (
        <ErrorState
          message={query.error?.message ?? profile.error?.message ?? t("common.error")}
          retry={() => { query.refetch(); profile.refetch(); }}
        />
      ) : null}
      {!query.isLoading && !query.error && !query.data ? <ErrorState message={t("workout.notFound")} translated /> : null}

      {draft ? (
        <>
          <Text variant="caption" tone="muted" weight="medium" style={{ fontSize: 13, marginTop: 20, marginBottom: 7 }}>{t("workout.type")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 15 }}>
            {[...BASE_WORKOUT_TYPES, ...(groups.data ?? []).map((group) => `Split ${group.name}`)].map((value) => (
              <Chip key={value} selected={draft.type === value} onPress={() => patch((current) => ({ ...current, type: value }))}>
                {value}
              </Chip>
            ))}
          </ScrollView>
          <Text variant="caption" tone="muted" weight="medium" style={{ fontSize: 13, marginTop: 8, marginBottom: 7 }}>{t("workout.date")}</Text>
          <Pressable onPress={() => setDatePickerOpen(true)} disabled={update.isPending || remove.isPending} accessibilityRole="button" accessibilityLabel={t("workout.date")} style={dateButtonStyle}>
            <Text>{inputDateLabel(draft.date)}</Text>
            {Platform.OS === "ios" ? null : <Ionicons name="calendar-outline" size={18} color={colors.muted} />}
          </Pressable>
          {draft.showNotes || draft.notes ? (
            <View style={{ marginBottom: 16 }}>
              <Text variant="micro" tone="muted" style={{ marginBottom: 8 }}>{t("workout.note")}</Text>
              <View>
                <TextInput
                  value={draft.notes}
                  onChangeText={(notes) => patch((current) => ({ ...current, notes }))}
                  placeholder={t("workout.notePlaceholder")}
                  placeholderTextColor={colors.faint}
                  multiline
                  style={[inputStyle, { minHeight: 82, marginBottom: 0, paddingRight: 46, textAlignVertical: "top", paddingTop: 13 }]}
                />
                <Pressable onPress={() => patch((current) => ({ ...current, notes: "", showNotes: false }))} accessibilityRole="button" accessibilityLabel={t("workout.removeNote")} style={{ position: "absolute", right: 5, top: 3, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="close" size={19} color={colors.muted} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => patch((current) => ({ ...current, showNotes: true }))} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 38, marginBottom: 14 }}>
              <Ionicons name="document-text-outline" size={17} color={colors.muted} />
              <Text tone="muted" weight="medium" style={{ fontSize: 14 }}>{t("workout.addNote")}</Text>
            </Pressable>
          )}

          <SortableWorkoutExercises
            items={draft.exercises}
            onReorder={moveExercise}
            onDragChange={setReordering}
            scrollRef={workoutScrollRef}
            scrollOffsetRef={scrollOffsetRef}
            renderCard={(entry, exerciseIndex, dragHandle) => (
              <Card radius={23} padding={16}>
                <WorkoutExerciseHeader
                  dragHandle={dragHandle}
                  name={entry.name}
                  muscleGroupName={entry.muscleGroupName || groupNames.get(exerciseById.get(entry.exerciseId)?.muscle_group_id ?? "") || ""}
                  machine={entry.equipment === "machine"}
                  noteActive={entry.showNotes || Boolean(entry.notes)}
                  onMachine={() => openMachine(entry)}
                  onCompare={() => openCompare(entry)}
                  onNote={() => updateExercise(entry.key, (current) => ({ ...current, showNotes: !current.showNotes }))}
                  onRemove={() => patch((current) => ({ ...current, exercises: current.exercises.filter((item) => item.key !== entry.key) }))}
                />
                <View style={{ flexDirection: "row", marginBottom: 7, gap: 5, alignItems: "center" }}>
                  <Text variant="micro" tone="faint" style={{ width: 26 }}>#</Text>
                  <Text variant="micro" tone="faint" style={{ flex: 1 }}>
                    {t(entry.equipment === "bodyweight" ? "set.addedLoad" : "set.weight", { unit: entry.unit }).toUpperCase()}
                  </Text>
                  <Text variant="micro" tone="faint" style={{ flex: 1 }}>{t("set.reps").toUpperCase()}</Text>
                  <Text variant="micro" tone="faint" style={{ width: 36, textAlign: "center" }}>{t("set.fail").toUpperCase()}</Text>
                  <View style={{ width: 28 }} />
                </View>
                {entry.sets.map((set, setIndex) => (
                  <View key={set.key} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 }}>
                    <Pressable
                      onPress={() => updateExercise(entry.key, (current) => ({
                        ...current,
                        sets: current.sets.map((item) => item.key === set.key
                          ? { ...item, warmup: !item.warmup, toFailure: false }
                          : item),
                      }))}
                      accessibilityRole="button"
                      accessibilityLabel={t(set.warmup ? "set.markWorking" : "set.markWarmup")}
                      style={{ width: 26, height: 29, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: set.warmup ? "rgba(24,39,136,0.35)" : "transparent", borderColor: set.warmup ? "rgba(64,84,214,0.38)" : "transparent", borderWidth: 1 }}
                    >
                      <Text variant="caption" tone={set.warmup ? "white" : "faint"} style={{ fontFamily: set.warmup ? fonts.semibold : fonts.dot, fontSize: set.warmup ? 11 : 14 }}>
                        {set.warmup ? t("set.warmupShort") : entry.sets.slice(0, setIndex + 1).filter((item) => !item.warmup).length}
                      </Text>
                    </Pressable>
                    {entry.equipment === "bodyweight" ? (
                      <WorkoutBodyweightLoad
                        bodyWeightKg={draftBodyWeightKg(draft, unit)}
                        unit={entry.unit}
                        addedWeight={set.addedWeight ?? ""}
                        warmup={set.warmup}
                        onChange={(addedWeight) => {
                          const base = draftBodyWeightKg(draft, unit);
                          const total = base == null ? "" : String(roundWeight(kgToUnit(base, entry.unit) + (parseSignedWeight(addedWeight) ?? 0)));
                          updateExercise(entry.key, (current) => ({
                            ...current,
                            sets: current.sets.map((item) => item.key === set.key ? { ...item, addedWeight, weight: total } : item),
                          }));
                        }}
                      />
                    ) : (
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <TextInput
                          value={set.weight}
                          onChangeText={(value) => updateExercise(entry.key, (current) => ({
                            ...current,
                            sets: current.sets.map((item) => item.key === set.key ? { ...item, weight: value.replace(/[^\d.,]/g, "") } : item),
                          }))}
                          keyboardType="numbers-and-punctuation"
                          placeholder="0"
                          placeholderTextColor={colors.faint}
                          style={[inputStyle, { marginBottom: 0, height: 44, minHeight: 44, paddingHorizontal: 9, paddingRight: entry.equipment !== "crossover" ? 31 : 9, backgroundColor: set.warmup ? "rgba(24,39,136,0.12)" : colors.raised, borderColor: set.warmup ? "rgba(64,84,214,0.18)" : colors.line }]}
                        />
                        {entry.equipment !== "crossover" ? (
                          <Pressable onPress={() => openPlates(entry, set.weight)} disabled={parseWeight(set.weight) == null} accessibilityRole="button" accessibilityLabel={t("set.plates")} style={{ position: "absolute", right: 4, top: 0, width: 28, height: 44, alignItems: "center", justifyContent: "center", opacity: parseWeight(set.weight) == null ? 0.35 : 1 }}>
                            <WorkoutGlyph name="plates" size={18} color={colors.faint} />
                          </Pressable>
                        ) : null}
                      </View>
                    )}
                    <TextInput
                      value={set.reps}
                      onChangeText={(value) => updateExercise(entry.key, (current) => ({
                        ...current,
                        sets: current.sets.map((item) => item.key === set.key ? { ...item, reps: value.replace(/\D/g, "") } : item),
                      }))}
                      keyboardType="number-pad"
                      placeholder={set.warmup ? String([10, 5, 3][Math.min(entry.sets.slice(0, setIndex + 1).filter((item) => item.warmup).length - 1, 2)]) : "0"}
                      placeholderTextColor={colors.faint}
                      style={[inputStyle, { flex: 1, marginBottom: 0, height: 44, minHeight: 44, paddingHorizontal: 9, backgroundColor: set.warmup ? "rgba(24,39,136,0.12)" : colors.raised, borderColor: set.warmup ? "rgba(64,84,214,0.18)" : colors.line }]}
                    />
                    {set.warmup ? <View style={{ width: 36, height: 36 }} /> : (
                      <Pressable
                        onPress={() => updateExercise(entry.key, (current) => ({
                          ...current,
                          sets: current.sets.map((item) => item.key === set.key ? { ...item, toFailure: !item.toFailure } : item),
                        }))}
                        accessibilityRole="switch"
                        accessibilityLabel={t("set.toFailure")}
                        accessibilityState={{ checked: set.toFailure }}
                        style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: set.toFailure ? "rgba(224,75,46,0.5)" : colors.line, backgroundColor: set.toFailure ? "rgba(224,75,46,0.2)" : colors.raised, justifyContent: "center", alignItems: "center" }}
                      >
                        <WorkoutGlyph name="flame" size={17} color={set.toFailure ? colors.flameText : colors.faint} />
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => updateExercise(entry.key, (current) => ({ ...current, sets: current.sets.length > 1 ? current.sets.filter((item) => item.key !== set.key) : current.sets }))}
                      disabled={entry.sets.length === 1}
                      accessibilityRole="button"
                      accessibilityLabel={t("set.removeSet")}
                      style={{ width: 28, height: 38, alignItems: "center", justifyContent: "center", opacity: entry.sets.length === 1 ? 0.3 : 1 }}
                    >
                      <Ionicons name="close" size={18} color={colors.faint} />
                    </Pressable>
                  </View>
                ))}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 9 }}>
                  <Button variant="ghost" size="sm" leading={<Ionicons name="add" size={18} color={colors.lime} />} textStyle={{ color: colors.lime }} onPress={() => updateExercise(entry.key, (current) => ({
                    ...current,
                    sets: [...current.sets, createDraftSet(current.sets.findLast((set) => !set.warmup) ?? current.sets.at(-1))],
                  }))}>{t("set.addSet")}</Button>
                  <Button variant="ghost" size="sm" leading={<Ionicons name="add" size={18} color="#aeb8ff" />} textStyle={{ color: "#aeb8ff" }} onPress={() => updateExercise(entry.key, (current) => ({
                    ...current,
                    sets: withWarmupSet(current),
                  }))}>{t("set.addWarmup")}</Button>
                </View>
                {entry.showNotes ? (
                  <View style={{ marginTop: 9 }}>
                    <TextInput
                      value={entry.notes}
                      onChangeText={(notes) => updateExercise(entry.key, (current) => ({ ...current, notes }))}
                      placeholder={t("exercise.notePlaceholder")}
                      placeholderTextColor={colors.faint}
                      multiline
                      style={[inputStyle, { minHeight: 68, marginBottom: 0, textAlignVertical: "top", paddingTop: 12 }]}
                    />
                  </View>
                ) : null}
              </Card>
            )}
          />

          <Button variant="surface" block dashed leading={<Ionicons name="add" size={20} color={colors.lime} />} style={{ marginTop: 16 }} onPress={() => setExercisePicker(true)}>
            {t("workout.addExercise")}
          </Button>
          <Card radius={21} padding={17} style={{ marginTop: 23, marginBottom: 16 }}>
            <Text variant="micro" tone="muted">{t("bodyWeight.title").toUpperCase()}</Text>
            <Text variant="caption" tone="faint" style={{ marginTop: 4, marginBottom: 11 }}>
              {t("bodyWeight.current")}: {formatWeight(profile.data?.body_weight_kg, unit)}
            </Text>
            <TextInput
              value={draft.bodyWeight}
              onChangeText={(bodyWeight) => patch((current) => ({ ...current, bodyWeight, bodyWeightUnit: unit, bodyWeightAuto: false }))}
              placeholder={t("bodyWeight.inputLabel", { unit })}
              placeholderTextColor={colors.faint}
              keyboardType="decimal-pad"
              accessibilityLabel={t("bodyWeight.inputLabel", { unit })}
              style={[inputStyle, { marginBottom: 0 }]}
            />
          </Card>

          {error ? <Text tone="pink" style={{ marginBottom: 10 }}>{error}</Text> : null}
          <Button variant="gradient" size="lg" block disabled={!canSave} loading={update.isPending} onPress={save}>
            {t("common.saveChanges")}
          </Button>
          <Button variant="danger" size="lg" block disabled={update.isPending} loading={remove.isPending} onPress={confirmDelete} style={{ marginTop: 12 }}>
            {t("workout.delete")}
          </Button>
        </>
      ) : null}

      <BottomSheet open={exercisePicker} onClose={closeExercisePicker} title={t(creatingExercise ? "picker.newTitle" : "picker.title")} closeLabel={t("common.close")}>
        {creatingExercise ? (
          <InlineExerciseCreate
            groups={groups.data ?? []}
            profileUnit={unit}
            defaultGroupId={pickerGroupId}
            onCreated={chooseExercise}
            onCancel={() => setCreatingExercise(false)}
          />
        ) : (
          <View>
            <TextInput value={pickerSearch} onChangeText={setPickerSearch} placeholder={t("picker.search")} placeholderTextColor={colors.faint} style={inputStyle} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 13 }}>
              <Chip selected={pickerGroupId === null} onPress={() => setPickerGroupId(null)}>{t("common.all")}</Chip>
              {(groups.data ?? []).map((group) => (
                <Chip key={group.id} selected={pickerGroupId === group.id} onPress={() => setPickerGroupId(group.id)}>{group.name}</Chip>
              ))}
            </ScrollView>
            {exercises.isLoading || groups.isLoading ? <LoadingState /> : null}
            {exercises.error || groups.error ? (
              <View style={{ gap: 10, marginVertical: 12 }}>
                <Text tone="pink">{t("common.error")}</Text>
                <Button size="sm" onPress={() => { void exercises.refetch(); void groups.refetch(); }}>{t("common.retry")}</Button>
              </View>
            ) : null}
            {!exercises.isLoading && !groups.isLoading && !exercises.error && !groups.error ? (
              <>
                {pickerResults.map((exercise) => (
                  <Pressable key={exercise.id} onPress={() => chooseExercise(exercise)} style={pickerRow}>
                    <View style={{ flex: 1 }}>
                      <Text>{exercise.name}</Text>
                      <Text tone="muted" variant="caption" style={{ marginTop: 3 }}>
                        {groupNames.get(exercise.muscle_group_id)} · {t(`equipment.${exercise.equipment}`)}
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={21} color={colors.lime} />
                  </Pressable>
                ))}
                {pickerResults.length === 0 ? (
                  <Text tone="muted" style={{ paddingVertical: 16 }}>
                    {pickerSearch.trim() ? t("picker.emptyFor", { query: pickerSearch.trim() }) : t("picker.empty")}
                  </Text>
                ) : null}
              </>
            ) : null}
            <Button variant="surface" block dashed leading={<Ionicons name="add" size={18} color={colors.lime} />} disabled={groups.isLoading || !groups.data?.length} onPress={() => setCreatingExercise(true)} style={{ marginTop: 18 }}>
              {t("picker.createNew")}
            </Button>
          </View>
        )}
      </BottomSheet>
      {Platform.OS === "ios" ? (
        <BottomSheet open={datePickerOpen && Boolean(draft)} onClose={() => setDatePickerOpen(false)} title={t("workout.date")} closeLabel={t("common.close")}>
          <DateTimePicker
            value={pickerDate(draft?.date ?? localISO())}
            mode="date"
            display="inline"
            themeVariant="dark"
            accentColor={colors.lime}
            onChange={(_event, selected) => selected && patch((current) => ({ ...current, date: localISO(selected) }))}
          />
          <Button variant="surface" block onPress={() => setDatePickerOpen(false)} style={{ marginTop: 12 }}>{t("common.close")}</Button>
        </BottomSheet>
      ) : datePickerOpen && draft ? (
        <DateTimePicker
          value={pickerDate(draft.date)}
          mode="date"
          display="default"
          onChange={(event, selected) => {
            setDatePickerOpen(false);
            if (event.type === "set" && selected) patch((current) => ({ ...current, date: localISO(selected) }));
          }}
        />
      ) : null}
      <BottomSheet open={Boolean(exerciseTool && toolExercise)} onClose={closeExerciseTool} title={t(exerciseTool?.kind === "machine" ? "machine.title" : "compare.title")} closeLabel={t("common.close")}>
        {toolExercise ? (
          exerciseTool?.kind === "machine" ? (
            <View style={{ gap: 13 }}>
              <Text variant="caption" tone="muted">{toolExercise.name}</Text>
              {machineEditing ? (
                <>
                  <TextInput
                    value={machineText}
                    onChangeText={setMachineText}
                    placeholder={t("machine.placeholder")}
                    placeholderTextColor={colors.faint}
                    multiline
                    style={[inputStyle, { minHeight: 116, marginBottom: 0, textAlignVertical: "top", paddingTop: 13 }]}
                  />
                  {machineError ? <Text tone="pink">{machineError}</Text> : null}
                  <View style={{ flexDirection: "row", gap: 9 }}>
                    <Button variant="surface" style={{ flex: 1 }} disabled={updateMachine.isPending} onPress={() => { setMachineEditing(false); setMachineText(liveMachineSettings ?? ""); }}>{t("common.cancel")}</Button>
                    <Button variant="lime" style={{ flex: 1 }} loading={updateMachine.isPending} onPress={() => void saveMachine()}>{t("common.save")}</Button>
                  </View>
                </>
              ) : (
                <>
                  <Card radius={18} padding={17}>
                    <Text tone="muted">{liveMachineSettings?.trim() || t("machine.empty")}</Text>
                  </Card>
                  <Button variant="surface" block onPress={() => setMachineEditing(true)}>{t(liveMachineSettings ? "machine.edit" : "machine.add")}</Button>
                </>
              )}
            </View>
          ) : (
            <View style={{ gap: 13 }}>
              <Text variant="caption" tone="muted">{toolExercise.name}</Text>
              {history.isLoading ? <LoadingState /> : history.error ? <Text tone="pink">{t("common.error")}</Text> : null}
              {!history.isLoading && !history.error && compareDates.length === 0 ? (
                <View style={{ alignItems: "center", gap: 7, paddingVertical: 28 }}>
                  <Text weight="semibold">{t("compare.emptyTitle")}</Text>
                  <Text tone="muted" variant="caption" style={{ textAlign: "center" }}>{t("compare.emptyHint")}</Text>
                </View>
              ) : !history.isLoading && !history.error ? (
              <>
              {toolExercise.sets.some((set) => set.weight.trim() || set.addedWeight?.trim() || set.reps.trim()) ? (
              <>
              <Text variant="micro" tone="muted">{t("compare.thisSession")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {toolExercise.sets.filter((set) => set.weight.trim() || set.addedWeight?.trim() || set.reps.trim()).map((set) => {
                  const total = parseWeight(set.weight);
                  return <WorkoutCompareChip key={set.key} weight={set.weight || "—"} reps={set.reps || "—"} unit={toolExercise.unit} warmup={set.warmup} toFailure={set.toFailure} bodyWeightKg={toolExercise.equipment === "bodyweight" && draft ? draftBodyWeightKg(draft, unit) : undefined} totalWeightKg={total == null ? null : unitToKg(total, toolExercise.unit)} />;
                })}
              </View>
              </>
              ) : null}
              {compareDates.length ? (
                <>
                  <Pressable
                    onPress={() => {
                      if (!compareCalendarOpen && activeCompareDay) setCompareMonth(activeCompareDay.slice(0, 7));
                      setCompareCalendarOpen((open) => !open);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={activeCompareDay ?? t("compare.pickDay")}
                    style={compareDateRowStyle}
                  >
                    <Ionicons name="calendar-outline" size={18} color={colors.lime} />
                    <Text style={{ flex: 1 }}>{activeCompareDay ? pickerDate(activeCompareDay).toLocaleDateString(lang, { dateStyle: "long" }) : t("compare.pickDay")}</Text>
                    <Ionicons name={compareCalendarOpen ? "chevron-up" : "chevron-down"} size={17} color={colors.muted} />
                  </Pressable>
                  {compareCalendarOpen ? (
                    <View style={compareCalendarStyle}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                        <Pressable onPress={() => shiftCompareMonth(-1)} disabled={compareMonth <= (compareDates.at(-1)?.slice(0, 7) ?? compareMonth)} accessibilityRole="button" accessibilityLabel={t("history.previous")} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center", opacity: compareMonth <= (compareDates.at(-1)?.slice(0, 7) ?? compareMonth) ? 0.3 : 1 }}>
                          <Ionicons name="chevron-back" size={18} color={colors.text} />
                        </Pressable>
                        <Text weight="semibold">{compareMonthDate.toLocaleDateString(lang, { month: "long", year: "numeric" })}</Text>
                        <Pressable onPress={() => shiftCompareMonth(1)} disabled={compareMonth >= (compareDates[0]?.slice(0, 7) ?? compareMonth)} accessibilityRole="button" accessibilityLabel={t("history.next")} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center", opacity: compareMonth >= (compareDates[0]?.slice(0, 7) ?? compareMonth) ? 0.3 : 1 }}>
                          <Ionicons name="chevron-forward" size={18} color={colors.text} />
                        </Pressable>
                      </View>
                      <View style={{ flexDirection: "row" }}>
                        {Array.from({ length: 7 }, (_, index) => (
                          <Text key={index} variant="micro" tone="faint" style={{ width: "14.2857%", textAlign: "center", marginBottom: 5 }}>
                            {new Date(2024, 0, index + 1).toLocaleDateString(lang, { weekday: "short" }).toUpperCase()}
                          </Text>
                        ))}
                      </View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {calendarCells.map((day, index) => {
                          const date = new Date(compareYear, compareMonthNumber - 1, day, 12);
                          const iso = localISO(date);
                          const inMonth = date.getMonth() === compareMonthNumber - 1;
                          const available = inMonth && availableCompareDates.has(iso);
                          const selected = iso === activeCompareDay;
                          return (
                            <View key={index} style={{ width: "14.2857%", height: 45, alignItems: "center", justifyContent: "center" }}>
                              <Pressable onPress={() => { setCompareDay(iso); setCompareCalendarOpen(false); }} disabled={!available} accessibilityRole="button" accessibilityLabel={date.toLocaleDateString(lang, { dateStyle: "full" })} accessibilityState={{ selected, disabled: !available }} style={{ width: 39, height: 39, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.lime : "transparent" }}>
                                <Text variant="caption" style={{ color: selected ? colors.black : available ? colors.text : colors.faint, opacity: !inMonth ? 0.42 : 1 }}>{date.getDate()}</Text>
                                {available ? <View style={{ position: "absolute", bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: selected ? colors.black : colors.lime }} /> : null}
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}
              {selectedHistory.length ? (
                <View style={{ gap: 10 }}>
                  <Text variant="micro" tone="muted">{activeCompareDay ? pickerDate(activeCompareDay).toLocaleDateString(lang, { dateStyle: "long" }) : t("compare.selectedDay")}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {selectedHistory.flatMap(({ workout, entry }) => entry.sets.map((set) => (
                      <WorkoutCompareChip key={set.id} weight={set.weight_kg == null ? "—" : String(roundWeight(kgToUnit(set.weight_kg, toolExercise.unit)))} reps={set.reps == null ? "—" : String(set.reps)} unit={toolExercise.unit} warmup={set.set_type === "warmup"} toFailure={set.to_failure} bodyWeightKg={toolExercise.equipment === "bodyweight" ? workout.body_weight_kg : undefined} totalWeightKg={set.weight_kg} />
                    )))}
                  </View>
                  {selectedHistory.map(({ entry }) => entry.notes ? <Text key={entry.id} tone="muted" style={{ marginTop: 8 }}>{entry.notes}</Text> : null)}
                </View>
              ) : <Text tone="muted">{t("compare.noSets")}</Text>}
              </>
              ) : null}
            </View>
          )
        ) : null}
      </BottomSheet>
      <WorkoutPlateSheet context={plateContext} onClose={() => setPlateContext(null)} />
      <WorkoutConfirmSheet
        open={confirmDeleteOpen}
        title={t("workout.deleteTitle")}
        message={t("workout.deleteMessage")}
        confirmLabel={t("workout.delete")}
        loading={remove.isPending}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          if (!id || update.isPending || remove.isPending) return;
          remove.mutate(id, {
            onSuccess: () => { setConfirmDeleteOpen(false); router.replace("/history"); },
            onError: (failure) => setError(userErrorMessage(t, failure)),
          });
        }}
      />
    </Screen>
  );
}

const inputStyle = {
  backgroundColor: colors.raised,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: radii.medium,
  paddingHorizontal: 14,
  minHeight: 48,
  color: colors.text,
  fontFamily: fonts.regular,
  fontSize: 15,
  marginBottom: 15,
};

const pickerRow = {
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: colors.line,
  flexDirection: "row" as const,
  gap: 10,
};

const iconAction = {
  width: 34,
  height: 36,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  borderRadius: 18,
  backgroundColor: colors.raised,
};

const dateButtonStyle = {
  minHeight: 48,
  borderRadius: radii.medium,
  backgroundColor: colors.raised,
  borderWidth: 1,
  borderColor: colors.line,
  paddingHorizontal: 14,
  marginBottom: 15,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
};

const compareDateRowStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
  paddingHorizontal: 14,
  minHeight: 48,
  borderRadius: radii.medium,
  borderWidth: 1,
  borderColor: colors.line,
  backgroundColor: colors.raised,
};

const compareCalendarStyle = {
  backgroundColor: colors.raised,
  borderRadius: radii.medium,
  borderWidth: 1,
  borderColor: colors.line,
  padding: 12,
};
