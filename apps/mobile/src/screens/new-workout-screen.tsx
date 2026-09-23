import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import type { Exercise, Workout, WorkoutTemplateExercise } from "@deepgym/core/types";
import { BASE_WORKOUT_TYPES } from "@deepgym/core/workout";
import { kgToUnit, roundWeight } from "@deepgym/core/weight";
import { colors, fonts, radii } from "../theme";
import { BottomSheet, Button, Card, Chip, Screen, Text } from "../ui";
import {
  createDraftSet,
  DraftChangedBeforeSaveError,
  draftIsEmpty,
  exerciseToDraft,
  flushWorkoutDraftBeforeSave,
  useWorkoutDraft,
  type DraftExercise,
  type WorkoutDraft,
} from "../data/draft";
import { bodyweightDraftError, draftToInput } from "../data/draft-convert";
import { useCreateWorkout, useExercises, useMuscleGroups, useProfile, useTemplates, useWorkouts } from "../data/queries";
import { workoutRpcErrorKey } from "../data/workout-rpc";
import { userErrorMessage } from "../lib/user-error";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/auth-provider";
import { useI18n } from "../providers/locale-provider";
import { Header, LoadingState } from "./common";
import { localISO } from "./format";
import { InlineExerciseCreate } from "./inline-exercise-create";

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return localISO(new Date(year, month - 1, day)) === value;
}

function copyWorkout(workout: Workout, defaultUnit: "kg" | "lb"): WorkoutDraft {
  return {
    type: workout.type,
    date: localISO(),
    notes: "",
    showNotes: false,
    bodyWeight: workout.body_weight_kg == null ? "" : String(roundWeight(kgToUnit(workout.body_weight_kg, defaultUnit))),
    bodyWeightUnit: defaultUnit,
    bodyWeightAuto: true,
    exercises: workout.workout_exercises.map((entry) => {
      const unit = entry.exercise?.unit ?? defaultUnit;
      return {
        key: `${Date.now()}-${Math.random()}`,
        exerciseId: entry.exercise_id,
        name: entry.exercise?.name ?? "",
        muscleGroupName: "",
        equipment: entry.exercise.equipment,
        machineSettings: entry.exercise.machine_settings,
        unit,
        notes: "",
        showNotes: false,
        sets: entry.sets.map((set) => ({
          key: `${Date.now()}-${Math.random()}`,
          weight: set.weight_kg == null ? "" : String(roundWeight(kgToUnit(set.weight_kg, unit))),
          addedWeight: entry.load_mode === "bodyweight" && workout.body_weight_kg != null && set.weight_kg != null
            ? String(roundWeight(kgToUnit(set.weight_kg - workout.body_weight_kg, unit)))
            : undefined,
          reps: set.reps == null ? "" : String(set.reps),
          toFailure: set.to_failure,
          warmup: set.set_type === "warmup",
        })),
      };
    }),
  };
}

export function NewWorkoutScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ type?: string; date?: string; template?: string; first?: string }>();
  const profile = useProfile();
  const exercises = useExercises();
  const groups = useMuscleGroups();
  const templates = useTemplates();
  const history = useWorkouts();
  const createWorkout = useCreateWorkout();
  const draft = useWorkoutDraft((state) => state.draft);
  const hydrated = useWorkoutDraft((state) => state.hydrated);
  const syncReady = useWorkoutDraft((state) => state.syncReady);
  const cloudVerified = useWorkoutDraft((state) => state.cloudVerified);
  const draftOwnerId = useWorkoutDraft((state) => state.ownerId);
  const pendingRemote = useWorkoutDraft((state) => state.pendingRemote);
  const edit = useWorkoutDraft((state) => state.edit);
  const replace = useWorkoutDraft((state) => state.replace);
  const reset = useWorkoutDraft((state) => state.reset);
  const resolveConflict = useWorkoutDraft((state) => state.resolveConflict);
  const [exercisePicker, setExercisePicker] = useState(false);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null);
  const [templatePicker, setTemplatePicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const handledParams = useRef<string | null>(null);
  const unit = profile.data?.unit ?? "kg";
  const groupName = new Map((groups.data ?? []).map((group) => [group.id, group.name]));
  const filteredExercises = (exercises.data ?? []).filter((exercise) =>
    (!pickerGroupId || exercise.muscle_group_id === pickerGroupId) &&
    exercise.name.toLocaleLowerCase().includes(pickerSearch.trim().toLocaleLowerCase()),
  );

  function closeExercisePicker() {
    setExercisePicker(false);
    setCreatingExercise(false);
    setPickerSearch("");
  }

  function patch(change: (current: WorkoutDraft) => WorkoutDraft) {
    if (!user || saveInFlight.current) return;
    edit(user.id, change);
  }

  function updateExercise(key: string, change: (entry: DraftExercise) => DraftExercise) {
    patch((current) => ({
      ...current,
      exercises: current.exercises.map((entry) => entry.key === key ? change(entry) : entry),
    }));
  }

  function chooseExercise(exercise: Exercise) {
    patch((current) => ({
      ...current,
      exercises: [...current.exercises, exerciseToDraft(
        exercise,
        groupName.get(exercise.muscle_group_id) ?? "",
        unit,
        profile.data?.body_weight_kg ?? null,
      )],
    }));
    closeExercisePicker();
  }

  async function applyTemplate(id: string) {
    if (saveInFlight.current) return;
    const { data, error: templateError } = await supabase
      .from("workout_templates")
      .select("*, workout_template_exercises (*, exercise:exercises (*))")
      .eq("id", id)
      .single();
    if (templateError) throw templateError;
    const entries = (data.workout_template_exercises as WorkoutTemplateExercise[])
      .sort((a, b) => a.position - b.position);
    const next: WorkoutDraft = {
      ...draft,
      type: data.type,
      exercises: entries.map((entry) => exerciseToDraft(
        entry.exercise,
        groupName.get(entry.exercise.muscle_group_id) ?? "",
        unit,
        profile.data?.body_weight_kg ?? null,
      )),
    };
    if (!user || saveInFlight.current) return;
    replace(next, user.id, new Date().toISOString());
    setTemplatePicker(false);
  }

  useEffect(() => {
    if (!syncReady || !user || !profile.data || saveInFlight.current) return;
    const key = `${params.type ?? ""}|${params.date ?? ""}|${params.template ?? ""}`;
    if (key === "||" || handledParams.current === key) return;
    handledParams.current = key;
    if (params.template) {
      const perform = () => void applyTemplate(params.template!).catch((failure) =>
        setError(userErrorMessage(t, failure)));
      if (draftIsEmpty(useWorkoutDraft.getState().draft)) perform();
      else Alert.alert(t("workout.templateReplaceTitle"), t("workout.templateReplaceMessage"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("workout.templateReplaceConfirm"), onPress: perform },
      ]);
      return;
    }
    if (draftIsEmpty(useWorkoutDraft.getState().draft)) {
      edit(user.id, (current) => ({
        ...current,
        type: params.type ?? current.type,
        date: params.date && isValidDate(params.date) ? params.date : current.date,
      }));
    }
  }, [syncReady, user?.id, profile.data?.id, params.type, params.date, params.template]);

  function copyLast() {
    if (saveInFlight.current) return;
    const last = (history.data ?? []).find((workout) => workout.type === draft.type);
    if (!last) {
      setError(t("workout.noPrevious"));
      return;
    }
    const next = copyWorkout(last, unit);
    const perform = () => {
      if (user && !saveInFlight.current) replace({ ...next, date: draft.date }, user.id, new Date().toISOString());
    };
    if (draftIsEmpty(draft)) perform();
    else Alert.alert(t("workout.templateReplaceTitle"), t("workout.templateReplaceMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("workout.templateReplaceConfirm"), onPress: perform },
    ]);
  }

  function discard() {
    if (saveInFlight.current) return;
    Alert.alert(t("workout.discardTitle"), t("workout.discardMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("workout.discard"), style: "destructive", onPress: () => user && !saveInFlight.current && reset(user.id) },
    ]);
  }

  async function save() {
    if (saveInFlight.current) return;
    if (exercisePicker || templatePicker) return;
    setError(null);
    const current = useWorkoutDraft.getState();
    if (!user || current.ownerId !== user.id || !current.syncReady || !current.cloudVerified || current.pendingRemote) {
      return setError(t("workout.draftCloudPending"));
    }
    const currentDraft = current.draft;
    if (!isValidDate(currentDraft.date)) return setError(t("workout.invalidDate"));
    if (currentDraft.exercises.length === 0) return setError(t("workout.addExercise"));
    const issue = bodyweightDraftError(currentDraft, unit);
    if (issue) return setError(t(
      issue === "missing-body-weight"
        ? "bodyWeight.requiredForAddedLoad"
        : issue === "nonpositive-total"
          ? "bodyWeight.invalidTotalLoad"
          : "bodyWeight.invalidAddedLoad",
    ));
    const input = draftToInput(currentDraft, unit);
    if (!input.exercises.some((entry) => entry.sets.some((set) => set.reps != null))) {
      return setError(t("workout.completedSetRequired"));
    }
    const createKey = currentDraft.createKey;
    if (!createKey) return setError(t("workout.draftNotReady"));
    const firstSuccessfulWorkout = params.first === "1" && history.data?.length === 0;
    const savedDate = currentDraft.date;
    saveInFlight.current = true;
    setSaving(true);
    let cloudReady = false;
    try {
      await flushWorkoutDraftBeforeSave(user.id, currentDraft, current.updatedAt);
      cloudReady = true;
      const afterFlush = useWorkoutDraft.getState();
      if (afterFlush.ownerId !== user.id || afterFlush.draft !== currentDraft) {
        throw new DraftChangedBeforeSaveError("Draft changed while preparing save");
      }
      const id = await createWorkout.mutateAsync({ input, createKey });
      const afterSave = useWorkoutDraft.getState();
      if (afterSave.ownerId !== user.id || afterSave.draft !== currentDraft) {
        // The saved snapshot is available in History. Keep later edits and the
        // same key so a retry cannot silently create a second workout.
        setError(t("workout.alreadySavedConflict"));
        return;
      }
      reset(user.id);
      if (firstSuccessfulWorkout) {
        router.replace({ pathname: "/history", params: { first: "1", date: savedDate } });
      } else {
        router.replace({ pathname: "/workouts/[id]", params: { id } });
      }
    } catch (failure) {
      if (failure instanceof DraftChangedBeforeSaveError) {
        setError(t("workout.draftNotReady"));
      } else if (!cloudReady) {
        setError(t("workout.draftCloudPending"));
      } else {
        const key = workoutRpcErrorKey(failure);
        setError(key ? t(key) : userErrorMessage(t, failure));
      }
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  if (!hydrated || !syncReady || draftOwnerId !== user?.id) {
    return <Screen><Header title={t("workout.new")} back /><LoadingState /></Screen>;
  }

  return (
    <Screen bottomPadding={125} pointerEvents={saving ? "none" : "auto"}>
      <Header
        title={t("workout.new")}
        back
        action={<Button variant="lime" size="sm" loading={saving} disabled={!cloudVerified || Boolean(pendingRemote)} onPress={save}>{t("common.save")}</Button>}
      />
      {params.first === "1" ? (
        <View
          accessibilityRole="summary"
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "flex-start",
            backgroundColor: "rgba(215,246,81,0.08)",
            borderColor: "rgba(215,246,81,0.25)",
            borderWidth: 1,
            borderRadius: radii.medium,
            padding: 15,
            marginTop: 16,
          }}
        >
          <Text tone="lime" style={{ fontSize: 19, lineHeight: 23 }}>ⓘ</Text>
          <Text tone="muted" style={{ flex: 1 }}>{t("firstWorkout.mobileFormTip")}</Text>
        </View>
      ) : null}
      {!cloudVerified && !pendingRemote ? (
        <Text tone="muted" variant="caption" style={{ marginTop: 14 }}>
          {t("workout.draftCloudPending")}
        </Text>
      ) : null}
      <Text variant="micro" tone="muted" style={{ marginTop: 22, marginBottom: 9 }}>{t("workout.type")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 15 }}>
        {[...BASE_WORKOUT_TYPES, ...(groups.data ?? []).map((group) => `Split ${group.name}`)].map((value) => (
          <Chip key={value} selected={draft.type === value} onPress={() => patch((current) => ({ ...current, type: value }))}>{value}</Chip>
        ))}
      </ScrollView>
      <Text variant="micro" tone="muted" style={{ marginTop: 8, marginBottom: 9 }}>{t("workout.date")}</Text>
      <TextInput
        editable={!saving}
        value={draft.date}
        onChangeText={(date) => patch((current) => ({ ...current, date }))}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.faint}
        keyboardType="numbers-and-punctuation"
        style={inputStyle}
      />
      <TextInput
        editable={!saving}
        value={draft.notes}
        onChangeText={(notes) => patch((current) => ({ ...current, notes }))}
        placeholder={t("workout.addNote")}
        placeholderTextColor={colors.faint}
        multiline
        style={[inputStyle, { minHeight: 48, marginTop: 5 }]}
      />

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 19 }}>
        <Button variant="surface" size="sm" onPress={copyLast}>{t("workout.copyLast", { type: draft.type })}</Button>
        <Button variant="surface" size="sm" onPress={() => setTemplatePicker(true)}>{t("workout.useTemplate")}</Button>
      </View>

      <View style={{ gap: 13 }}>
        {draft.exercises.map((entry, exerciseIndex) => (
          <Card key={entry.key} radius={23} padding={16}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 14 }}>
              <Text variant="caption" tone="faint">{String(exerciseIndex + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text weight="semibold">{entry.name}</Text>
                <Text variant="caption" tone="muted">{entry.muscleGroupName}</Text>
              </View>
              <Text onPress={() => patch((current) => ({ ...current, exercises: current.exercises.filter((item) => item.key !== entry.key) }))} tone="muted">×</Text>
            </View>
            <View style={{ flexDirection: "row", marginBottom: 7, gap: 8 }}>
              <Text variant="micro" tone="faint" style={{ width: 20 }}>#</Text>
              <Text variant="micro" tone="faint" style={{ flex: 1 }}>
                {entry.equipment === "bodyweight" ? t("set.addedLoad", { unit: entry.unit }).toUpperCase() : t("set.weight", { unit: entry.unit }).toUpperCase()}
              </Text>
              <Text variant="micro" tone="faint" style={{ flex: 0.7 }}>{t("set.reps").toUpperCase()}</Text>
              <Text variant="micro" tone="faint" style={{ width: 50 }}>{t("set.fail").toUpperCase()}</Text>
            </View>
            {entry.sets.map((set, setIndex) => (
              <View key={set.key} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Text variant="caption" tone={set.warmup ? "pink" : "faint"} style={{ width: 20 }}>
                  {set.warmup ? t("set.warmupShort") : setIndex + 1}
                </Text>
                <TextInput
                  editable={!saving}
                  value={entry.equipment === "bodyweight" ? set.addedWeight ?? "0" : set.weight}
                  onChangeText={(value) => updateExercise(entry.key, (current) => ({
                    ...current,
                    sets: current.sets.map((item) => item.key === set.key
                      ? { ...item, [entry.equipment === "bodyweight" ? "addedWeight" : "weight"]: value }
                      : item),
                  }))}
                  keyboardType="numbers-and-punctuation"
                  placeholder="0"
                  placeholderTextColor={colors.faint}
                  style={[inputStyle, { flex: 1, marginBottom: 0, height: 42, minHeight: 42 }]}
                />
                <TextInput
                  editable={!saving}
                  value={set.reps}
                  onChangeText={(value) => updateExercise(entry.key, (current) => ({
                    ...current,
                    sets: current.sets.map((item) => item.key === set.key ? { ...item, reps: value } : item),
                  }))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.faint}
                  style={[inputStyle, { flex: 0.7, marginBottom: 0, height: 42, minHeight: 42 }]}
                />
                <Pressable
                  onPress={() => updateExercise(entry.key, (current) => ({
                    ...current,
                    sets: current.sets.map((item) => item.key === set.key ? { ...item, toFailure: !item.toFailure } : item),
                  }))}
                  style={{ width: 33, height: 39, borderRadius: 18, backgroundColor: set.toFailure ? "rgba(224,75,46,0.2)" : colors.raised, justifyContent: "center", alignItems: "center" }}
                >
                  <Text tone={set.toFailure ? "pink" : "muted"}>♨</Text>
                </Pressable>
                <Text
                  tone="faint"
                  onPress={() => updateExercise(entry.key, (current) => ({
                    ...current,
                    sets: current.sets.length > 1 ? current.sets.filter((item) => item.key !== set.key) : current.sets,
                  }))}
                >×</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text tone="lime" onPress={() => updateExercise(entry.key, (current) => ({
                ...current,
                sets: [...current.sets, createDraftSet(current.sets.at(-1))],
              }))}>＋ {t("workout.shortcutAddSet")}</Text>
              <Text tone="muted" onPress={() => updateExercise(entry.key, (current) => ({
                ...current,
                sets: [{ ...createDraftSet(), warmup: true }, ...current.sets],
              }))}>＋ {t("set.addWarmup")}</Text>
            </View>
          </Card>
        ))}
      </View>

      <Button variant="surface" block style={{ marginTop: 16 }} onPress={() => setExercisePicker(true)}>
        ＋ {t("workout.addExercise")}
      </Button>
      <Text variant="micro" tone="muted" style={{ marginTop: 26, marginBottom: 8 }}>{t("bodyWeight.title")}</Text>
      <TextInput
        editable={!saving}
        value={draft.bodyWeight}
        onChangeText={(bodyWeight) => patch((current) => ({ ...current, bodyWeight, bodyWeightUnit: unit, bodyWeightAuto: false }))}
        placeholder={t("bodyWeight.inputLabel", { unit })}
        placeholderTextColor={colors.faint}
        keyboardType="decimal-pad"
        style={inputStyle}
      />
      {error ? <Text tone="pink" style={{ marginBottom: 10 }}>{error}</Text> : null}
      <Button variant="lime" block loading={saving} disabled={!cloudVerified || Boolean(pendingRemote)} onPress={save}>
        {t("workout.save")}
      </Button>
      {!draftIsEmpty(draft) ? <Button variant="ghost" block onPress={discard} style={{ marginTop: 10 }}>{t("workout.discard")}</Button> : null}

      <BottomSheet
        open={exercisePicker}
        onClose={closeExercisePicker}
        title={t(creatingExercise ? "picker.newTitle" : "picker.title")}
        closeLabel={t("common.close")}
      >
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
            <TextInput
              editable={!saving}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder={t("picker.search")}
              placeholderTextColor={colors.faint}
              style={inputStyle}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 13 }}>
              <Chip selected={pickerGroupId === null} onPress={() => setPickerGroupId(null)}>{t("common.all")}</Chip>
              {(groups.data ?? []).map((group) => (
                <Chip key={group.id} selected={pickerGroupId === group.id} onPress={() => setPickerGroupId(group.id)}>
                  {group.name}
                </Chip>
              ))}
            </ScrollView>
            {exercises.isLoading || groups.isLoading ? <LoadingState /> : null}
            {exercises.error || groups.error ? (
              <View style={{ gap: 10, marginVertical: 12 }}>
                <Text tone="pink">{t("common.error")}</Text>
                <Button size="sm" onPress={() => { void exercises.refetch(); void groups.refetch(); }}>
                  {t("common.retry")}
                </Button>
              </View>
            ) : null}
            {!exercises.isLoading && !groups.isLoading && !exercises.error && !groups.error ? (
              <>
                {filteredExercises.map((exercise) => (
                  <Pressable key={exercise.id} onPress={() => chooseExercise(exercise)} style={pickerRow}>
                    <Text style={{ flex: 1 }}>{exercise.name}</Text>
                    <Text tone="muted" variant="caption">{groupName.get(exercise.muscle_group_id)}</Text>
                    <Text tone="lime">＋</Text>
                  </Pressable>
                ))}
                {filteredExercises.length === 0 ? (
                  <Text tone="muted" style={{ paddingVertical: 16 }}>
                    {pickerSearch.trim()
                      ? t("picker.emptyFor", { query: pickerSearch.trim() })
                      : t("picker.empty")}
                  </Text>
                ) : null}
              </>
            ) : null}
            <Button
              variant="surface"
              block
              dashed
              disabled={groups.isLoading || !groups.data?.length}
              onPress={() => setCreatingExercise(true)}
              style={{ marginTop: 18 }}
            >
              ＋ {t("picker.createNew")}
            </Button>
          </View>
        )}
      </BottomSheet>
      <BottomSheet open={templatePicker} onClose={() => setTemplatePicker(false)} title={t("workout.templatePickerTitle")} closeLabel={t("common.close")}>
        {(templates.data ?? []).map((template) => (
          <Pressable key={template.id} onPress={() => {
            const perform = () => void applyTemplate(template.id).catch((failure) => setError(userErrorMessage(t, failure)));
            if (draftIsEmpty(draft)) perform();
            else Alert.alert(t("workout.templateReplaceTitle"), t("workout.templateReplaceMessage"), [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("workout.templateReplaceConfirm"), onPress: perform },
            ]);
          }} style={pickerRow}>
            <Text style={{ flex: 1 }}>{template.name}</Text>
            <Text tone="muted" variant="caption">{template.exerciseCount}</Text>
          </Pressable>
        ))}
      </BottomSheet>
      <BottomSheet open={Boolean(pendingRemote && user && pendingRemote.ownerId === user.id)} onClose={() => router.back()} title={t("workout.draftConflictTitle")} closeLabel={t("common.close")}>
        <Text tone="muted" style={{ marginBottom: 20 }}>{t("workout.draftConflictMessage")}</Text>
        <Button variant="lime" block onPress={() => user && resolveConflict(user.id, false)}>{t("workout.draftKeepDevice")}</Button>
        <Button variant="surface" block style={{ marginTop: 10 }} onPress={() => user && resolveConflict(user.id, true)}>{t("workout.draftKeepCloud")}</Button>
      </BottomSheet>
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
