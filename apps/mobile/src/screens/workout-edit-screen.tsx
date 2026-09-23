import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import type { Exercise } from "@deepgym/core/types";
import { BASE_WORKOUT_TYPES } from "@deepgym/core/workout";
import { parseWeight, unitToKg } from "@deepgym/core/weight";
import { colors, fonts, radii } from "../theme";
import { BottomSheet, Button, Card, Chip, Screen, Text } from "../ui";
import { createDraftSet, exerciseToDraft, type DraftExercise, type WorkoutDraft } from "../data/draft";
import { bodyweightDraftError, draftToInput } from "../data/draft-convert";
import { useDeleteWorkout, useExercises, useMuscleGroups, useProfile, useWorkout } from "../data/queries";
import { useUpdateWorkout, workoutToEditDraft } from "../data/workout-edit";
import { workoutRpcErrorKey } from "../data/workout-rpc";
import { useI18n } from "../providers/locale-provider";
import { userErrorMessage } from "../lib/user-error";
import { ErrorState, Header, LoadingState } from "./common";

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function WorkoutEditScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t } = useI18n();
  const query = useWorkout(id ?? "");
  const profile = useProfile();
  const groups = useMuscleGroups();
  const exercises = useExercises();
  const update = useUpdateWorkout();
  const remove = useDeleteWorkout();
  const initializedFor = useRef<string | null>(null);
  const [storedDraft, setDraft] = useState<WorkoutDraft | null>(null);
  const draft = initializedFor.current === id ? storedDraft : null;
  const [exercisePicker, setExercisePicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unit = profile.data?.unit ?? "kg";
  const groupNames = useMemo(
    () => new Map((groups.data ?? []).map((group) => [group.id, group.name])),
    [groups.data],
  );

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

  function moveExercise(key: string, step: -1 | 1) {
    patch((current) => {
      const from = current.exercises.findIndex((entry) => entry.key === key);
      const to = from + step;
      if (from < 0 || to < 0 || to >= current.exercises.length) return current;
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
    setExercisePicker(false);
    setPickerSearch("");
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
    Alert.alert(t("workout.deleteTitle"), t("workout.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("workout.delete"),
        style: "destructive",
        onPress: () => remove.mutate(id, {
          onSuccess: () => router.replace("/history"),
          onError: (failure) => setError(userErrorMessage(t, failure)),
        }),
      },
    ]);
  }

  const pickerResults = (exercises.data ?? []).filter((exercise) =>
    exercise.name.toLocaleLowerCase().includes(pickerSearch.toLocaleLowerCase()),
  );
  const canSave = Boolean(draft?.exercises.length) && !update.isPending && !remove.isPending;

  return (
    <Screen bottomPadding={48}>
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
          <Text variant="micro" tone="muted" style={{ marginTop: 20, marginBottom: 9 }}>{t("workout.type")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 15 }}>
            {[...BASE_WORKOUT_TYPES, ...(groups.data ?? []).map((group) => `Split ${group.name}`)].map((value) => (
              <Chip key={value} selected={draft.type === value} onPress={() => patch((current) => ({ ...current, type: value }))}>
                {value}
              </Chip>
            ))}
          </ScrollView>
          <Text variant="micro" tone="muted" style={{ marginTop: 8, marginBottom: 9 }}>{t("workout.date")}</Text>
          <TextInput
            value={draft.date}
            onChangeText={(date) => patch((current) => ({ ...current, date }))}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.faint}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            style={inputStyle}
          />
          <TextInput
            value={draft.notes}
            onChangeText={(notes) => patch((current) => ({ ...current, notes }))}
            placeholder={t("workout.addNote")}
            placeholderTextColor={colors.faint}
            multiline
            style={[inputStyle, { minHeight: 48, marginTop: 5 }]}
          />

          <View style={{ gap: 13 }}>
            {draft.exercises.map((entry, exerciseIndex) => (
              <Card key={entry.key} radius={23} padding={16}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 14 }}>
                  <Text variant="caption" tone="faint">{String(exerciseIndex + 1).padStart(2, "0")}</Text>
                  <View style={{ flex: 1 }}>
                    <Text weight="semibold" numberOfLines={1}>{entry.name}</Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>{entry.muscleGroupName}</Text>
                  </View>
                  <Pressable onPress={() => moveExercise(entry.key, -1)} disabled={exerciseIndex === 0} accessibilityRole="button" accessibilityLabel={t("exercise.reorder", { name: entry.name })} style={{ padding: 6, opacity: exerciseIndex === 0 ? 0.3 : 1 }}>
                    <Text tone="muted">↑</Text>
                  </Pressable>
                  <Pressable onPress={() => moveExercise(entry.key, 1)} disabled={exerciseIndex === draft.exercises.length - 1} accessibilityRole="button" accessibilityLabel={t("exercise.reorder", { name: entry.name })} style={{ padding: 6, opacity: exerciseIndex === draft.exercises.length - 1 ? 0.3 : 1 }}>
                    <Text tone="muted">↓</Text>
                  </Pressable>
                  <Pressable onPress={() => patch((current) => ({ ...current, exercises: current.exercises.filter((item) => item.key !== entry.key) }))} accessibilityRole="button" accessibilityLabel={t("exercise.remove")} style={{ padding: 6 }}>
                    <Text tone="muted">×</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: "row", marginBottom: 7, gap: 8 }}>
                  <Text variant="micro" tone="faint" style={{ width: 30 }}>#</Text>
                  <Text variant="micro" tone="faint" style={{ flex: 1 }}>
                    {t(entry.equipment === "bodyweight" ? "set.addedLoad" : "set.weight", { unit: entry.unit })}
                  </Text>
                  <Text variant="micro" tone="faint" style={{ flex: 0.65 }}>{t("set.reps")}</Text>
                  <Text variant="micro" tone="faint" style={{ width: 38 }}>{t("set.fail")}</Text>
                </View>
                {entry.sets.map((set, setIndex) => (
                  <View key={set.key} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Pressable
                      onPress={() => updateExercise(entry.key, (current) => ({
                        ...current,
                        sets: current.sets.map((item) => item.key === set.key
                          ? { ...item, warmup: !item.warmup, toFailure: item.warmup ? item.toFailure : false }
                          : item),
                      }))}
                      accessibilityRole="button"
                      accessibilityLabel={t(set.warmup ? "set.markWorking" : "set.markWarmup")}
                      style={{ width: 30, alignItems: "center", paddingVertical: 6 }}
                    >
                      <Text variant="caption" tone={set.warmup ? "pink" : "faint"}>{set.warmup ? t("set.warmupShort") : setIndex + 1}</Text>
                    </Pressable>
                    <TextInput
                      value={entry.equipment === "bodyweight" ? set.addedWeight ?? "" : set.weight}
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
                      value={set.reps}
                      onChangeText={(value) => updateExercise(entry.key, (current) => ({
                        ...current,
                        sets: current.sets.map((item) => item.key === set.key ? { ...item, reps: value } : item),
                      }))}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.faint}
                      style={[inputStyle, { flex: 0.65, marginBottom: 0, height: 42, minHeight: 42 }]}
                    />
                    <Pressable
                      onPress={() => updateExercise(entry.key, (current) => ({
                        ...current,
                        sets: current.sets.map((item) => item.key === set.key ? { ...item, toFailure: !item.toFailure } : item),
                      }))}
                      disabled={Boolean(set.warmup)}
                      accessibilityRole="button"
                      accessibilityLabel={t("set.toFailure")}
                      accessibilityState={{ checked: set.toFailure, disabled: Boolean(set.warmup) }}
                      style={{ width: 34, height: 39, borderRadius: 18, backgroundColor: set.toFailure ? "rgba(224,75,46,0.2)" : colors.raised, justifyContent: "center", alignItems: "center", opacity: set.warmup ? 0.3 : 1 }}
                    >
                      <Text tone={set.toFailure ? "pink" : "muted"}>♨</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => updateExercise(entry.key, (current) => ({ ...current, sets: current.sets.filter((item) => item.key !== set.key) }))}
                      accessibilityRole="button"
                      accessibilityLabel={t("set.removeSet")}
                      style={{ padding: 3 }}
                    >
                      <Text tone="faint">×</Text>
                    </Pressable>
                  </View>
                ))}
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 14 }}>
                  <Text tone="lime" onPress={() => updateExercise(entry.key, (current) => ({
                    ...current,
                    sets: [...current.sets, createDraftSet(current.sets.findLast((set) => !set.warmup) ?? current.sets.at(-1))],
                  }))}>＋ {t("set.addSet")}</Text>
                  <Text tone="muted" onPress={() => updateExercise(entry.key, (current) => ({
                    ...current,
                    sets: [{ ...createDraftSet(), warmup: true }, ...current.sets],
                  }))}>＋ {t("set.addWarmup")}</Text>
                </View>
                <TextInput
                  value={entry.notes}
                  onChangeText={(notes) => updateExercise(entry.key, (current) => ({ ...current, notes }))}
                  placeholder={t("exercise.notePlaceholder")}
                  placeholderTextColor={colors.faint}
                  multiline
                  style={[inputStyle, { minHeight: 46, marginBottom: 0 }]}
                />
              </Card>
            ))}
          </View>

          <Button variant="surface" block style={{ marginTop: 16 }} onPress={() => setExercisePicker(true)}>
            ＋ {t("workout.addExercise")}
          </Button>
          <Text variant="micro" tone="muted" style={{ marginTop: 26, marginBottom: 8 }}>{t("bodyWeight.title")}</Text>
          <TextInput
            value={draft.bodyWeight}
            onChangeText={(bodyWeight) => patch((current) => ({ ...current, bodyWeight, bodyWeightUnit: unit, bodyWeightAuto: false }))}
            placeholder={t("detail.weightUnit", { unit })}
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            style={inputStyle}
          />

          {error ? <Text tone="pink" style={{ marginBottom: 10 }}>{error}</Text> : null}
          <Button variant="gradient" size="lg" block disabled={!canSave} loading={update.isPending} onPress={save}>
            {t("common.saveChanges")}
          </Button>
          <Button variant="danger" size="lg" block disabled={update.isPending} loading={remove.isPending} onPress={confirmDelete} style={{ marginTop: 12 }}>
            {t("workout.delete")}
          </Button>
        </>
      ) : null}

      <BottomSheet open={exercisePicker} onClose={() => setExercisePicker(false)} title={t("workout.addExercise")} closeLabel={t("common.close")}>
        <TextInput
          value={pickerSearch}
          onChangeText={setPickerSearch}
          placeholder={t("exercises.title")}
          placeholderTextColor={colors.faint}
          style={inputStyle}
        />
        {pickerResults.map((exercise) => (
          <Pressable key={exercise.id} onPress={() => chooseExercise(exercise)} style={pickerRow}>
            <Text style={{ flex: 1 }}>{exercise.name}</Text>
            <Text tone="muted" variant="caption">{groupNames.get(exercise.muscle_group_id)}</Text>
          </Pressable>
        ))}
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
