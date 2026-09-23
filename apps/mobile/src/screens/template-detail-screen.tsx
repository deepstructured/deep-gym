import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { BASE_WORKOUT_TYPES } from "@deepgym/core/workout";
import { translateCount } from "@deepgym/core/i18n";
import { colors, fonts, radii } from "../theme";
import { BottomSheet, Button, Card, Chip, DotValue, Screen, Text } from "../ui";
import {
  useDeleteTemplate,
  useExercises,
  useMuscleGroups,
  useTemplate,
  useUpdateTemplate,
} from "../data/queries";
import { useI18n } from "../providers/locale-provider";
import { userErrorMessage } from "../lib/user-error";
import { ErrorState, Header, LoadingState } from "./common";

const inputStyle = {
  backgroundColor: colors.raised,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: radii.medium,
  color: colors.text,
  fontFamily: fonts.regular,
  fontSize: 16,
  paddingHorizontal: 16,
  height: 52,
} as const;

export function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const query = useTemplate(id ?? "");
  const groups = useMuscleGroups();
  const exercises = useExercises();
  const update = useUpdateTemplate();
  const remove = useDeleteTemplate();
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerGroup, setPickerGroup] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [exerciseIds, setExerciseIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const template = query.data;
  const groupName = new Map((groups.data ?? []).map((group) => [group.id, group.name]));
  const typeOptions = Array.from(new Set([
    ...BASE_WORKOUT_TYPES,
    ...(groups.data ?? []).map((group) => `Split ${group.name}`),
    type,
  ]));
  const pickerExercises = (exercises.data ?? []).filter((exercise) =>
    !exerciseIds.includes(exercise.id) &&
    (!pickerGroup || exercise.muscle_group_id === pickerGroup) &&
    exercise.name.toLocaleLowerCase().includes(pickerSearch.trim().toLocaleLowerCase()),
  );

  function openEditor() {
    if (!template) return;
    setName(template.name);
    setType(template.type);
    setExerciseIds(template.workout_template_exercises.map((entry) => entry.exercise_id));
    setError(null);
    setPickerOpen(false);
    setEditing(true);
  }

  async function save() {
    if (!template) return;
    if (!name.trim()) return setError(t("templates.nameRequired"));
    if (!exerciseIds.length) return setError(t("templates.exercisesRequired"));
    setError(null);
    try {
      await update.mutateAsync({ id: template.id, input: { name, type, exerciseIds } });
      setEditing(false);
    } catch (failure) {
      setError(userErrorMessage(t, failure));
    }
  }

  function openDeleteConfirmation() {
    if (!template) return;
    setError(null);
    setConfirmDelete(true);
  }

  async function deleteTemplate() {
    if (!template) return;
    try {
      await remove.mutateAsync(template.id);
      setConfirmDelete(false);
      router.replace("/library");
    } catch (failure) {
      setError(userErrorMessage(t, failure));
    }
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...exerciseIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setExerciseIds(next);
  }

  return (
    <Screen bottomPadding={44}>
      <Header
        title={template?.name ?? t("templates.title")}
        back
        action={template ? <Button size="compact" iconOnly variant="surface" onPress={openEditor} accessibilityLabel={t("templates.edit")}><Ionicons name="create-outline" size={18} color={colors.muted} /></Button> : null}
      />
      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message={query.error.message} retry={() => query.refetch()} /> : null}
      {!query.isLoading && !query.error && !template ? (
        <ErrorState message={t("templates.notFound")} translated />
      ) : null}
      {template ? (
        <View style={{ gap: 8, paddingTop: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 13 }}>
            <View style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: "rgba(215,246,81,0.28)", backgroundColor: "rgba(215,246,81,0.09)" }}>
              <Text variant="caption" tone="lime">{template.type}</Text>
            </View>
            <Text variant="caption" tone="muted">{translateCount(lang, "count.exercises", template.workout_template_exercises.length)}</Text>
          </View>

          <Text variant="micro" tone="muted" style={{ marginBottom: 2 }}>
            {t("templates.exercises")}
          </Text>
          {template.workout_template_exercises.length ? template.workout_template_exercises.map((entry, index) => (
            <Card key={entry.id} radius={radii.tile} padding={14}>
                <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                  <DotValue value={String(index + 1).padStart(2, "0")} size={15} color={colors.lime} />
                  <View style={{ flex: 1 }}>
                    <Text weight="medium" numberOfLines={1}>{entry.exercise?.name ?? t("exercises.title")}</Text>
                    <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                      {groupName.get(entry.exercise?.muscle_group_id ?? "") ?? ""}
                      {entry.exercise ? ` · ${t(`equipment.${entry.exercise.equipment}`)}` : ""}
                    </Text>
                  </View>
                </View>
            </Card>
          )) : <View style={{ borderRadius: radii.tile, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: 20 }}><Text tone="muted" style={{ textAlign: "center", fontSize: 14 }}>{t("templates.emptyExercises")}</Text></View>}

          <Button
            variant="gradient" size="lg" block
            disabled={!template.workout_template_exercises.length}
            onPress={() => router.push({ pathname: "/new", params: { template: template.id } })}
            leading={<Ionicons name="add" size={18} color={colors.white} />}
            style={{ marginTop: 18 }}
          >
            {t("templates.startWorkout")}
          </Button>
          <Button variant="danger" size="lg" block loading={remove.isPending} onPress={openDeleteConfirmation}>
            {t("templates.delete")}
          </Button>
          {error && !editing && !confirmDelete ? <Text tone="pink">{error}</Text> : null}
        </View>
      ) : null}

      <BottomSheet
        open={editing}
        onClose={() => { if (pickerOpen) setPickerOpen(false); else setEditing(false); }}
        closeLabel={t("common.close")}
        title={t(pickerOpen ? "workout.addExercise" : "templates.edit")}
        footer={pickerOpen ? undefined : <Button variant="gradient" size="lg" block loading={update.isPending} onPress={save}>{t("common.saveChanges")}</Button>}
      >
        {pickerOpen ? (
          <View style={{ gap: 16, paddingBottom: 12 }}>
            <TextInput value={pickerSearch} onChangeText={setPickerSearch} style={inputStyle} placeholder={t("picker.search")} placeholderTextColor={colors.faint} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip selected={pickerGroup === null} onPress={() => setPickerGroup(null)}>{t("common.all")}</Chip>
              {(groups.data ?? []).map((group) => <Chip key={group.id} selected={pickerGroup === group.id} onPress={() => setPickerGroup(group.id)}>{group.name}</Chip>)}
            </ScrollView>
            <View style={{ gap: 8 }}>
              {pickerExercises.map((exercise) => (
                <Pressable key={exercise.id} onPress={() => { setExerciseIds((ids) => [...ids, exercise.id]); setPickerOpen(false); setPickerSearch(""); setPickerGroup(null); }}
                  accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radii.tile, backgroundColor: colors.raised, paddingHorizontal: 16, paddingVertical: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text weight="medium" numberOfLines={1}>{exercise.name}</Text>
                    <Text variant="caption" tone="muted" style={{ marginTop: 3 }}>{groupName.get(exercise.muscle_group_id) ?? ""} · {t(`equipment.${exercise.equipment}`)}</Text>
                  </View>
                  <Ionicons name="add" size={19} color={colors.lime} />
                </Pressable>
              ))}
              {!pickerExercises.length ? <Text tone="muted" style={{ textAlign: "center", paddingVertical: 24 }}>{pickerSearch.trim() ? t("picker.emptyFor", { query: pickerSearch.trim() }) : t("picker.empty")}</Text> : null}
            </View>
          </View>
        ) : (
          <View style={{ gap: 16, paddingBottom: 12 }}>
            <View style={{ gap: 8 }}>
              <Text variant="caption" tone="muted">{t("templates.name")}</Text>
              <TextInput value={name} onChangeText={(value) => { setName(value); setError(null); }} style={inputStyle} placeholder={t("templates.namePlaceholder")} placeholderTextColor={colors.faint} maxLength={100} />
            </View>
            <View style={{ gap: 8 }}>
              <Text variant="caption" tone="muted">{t("workout.type")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {typeOptions.map((value) => <Chip key={value} selected={type === value} onPress={() => setType(value)}>{value}</Chip>)}
              </ScrollView>
            </View>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <Text variant="micro" tone="muted">{t("templates.exercises")}</Text>
              <DotValue value={exerciseIds.length} size={12} color={colors.faint} />
            </View>
            <View style={{ gap: 8 }}>
              {exerciseIds.map((exerciseId, index) => {
                const exercise = exercises.data?.find((candidate) => candidate.id === exerciseId);
                return (
                  <View key={`${exerciseId}-${index}`} style={{ flexDirection: "row", alignItems: "center", gap: 9, borderRadius: radii.tile, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 12, paddingLeft: 14, paddingRight: 10 }}>
                    <DotValue value={String(index + 1).padStart(2, "0")} size={14} color={colors.lime} />
                    <View style={{ flex: 1 }}>
                      <Text weight="medium" numberOfLines={1}>{exercise?.name ?? exerciseId}</Text>
                      <Text variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 3 }}>{groupName.get(exercise?.muscle_group_id ?? "") ?? ""}</Text>
                    </View>
                    <Button size="sm" iconOnly onPress={() => move(index, -1)} disabled={index === 0} accessibilityLabel={t("templates.moveUp", { name: exercise?.name ?? exerciseId })}><Ionicons name="chevron-up" size={17} color={colors.muted} /></Button>
                    <Button size="sm" iconOnly onPress={() => move(index, 1)} disabled={index === exerciseIds.length - 1} accessibilityLabel={t("templates.moveDown", { name: exercise?.name ?? exerciseId })}><Ionicons name="chevron-down" size={17} color={colors.muted} /></Button>
                    <Button size="sm" iconOnly variant="ghost" onPress={() => setExerciseIds((ids) => ids.filter((_, position) => position !== index))} accessibilityLabel={t("templates.removeExercise", { name: exercise?.name ?? exerciseId })}><Ionicons name="trash-outline" size={17} color={colors.flameText} /></Button>
                  </View>
                );
              })}
              {!exerciseIds.length ? <View style={{ borderRadius: radii.tile, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: 16 }}><Text tone="muted" style={{ textAlign: "center" }}>{t("templates.emptyExercises")}</Text></View> : null}
            </View>
            <Button variant="surface" block dashed leading={<Ionicons name="add" size={18} color={colors.text} />} onPress={() => { setPickerSearch(""); setPickerGroup(null); setPickerOpen(true); }}>{t("workout.addExercise")}</Button>
            {error ? <Text tone="pink">{error}</Text> : null}
          </View>
        )}
      </BottomSheet>

      <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t("templates.deleteTitle")} closeLabel={t("common.close")}
        footer={<View style={{ flexDirection: "row", gap: 10 }}><Button variant="surface" style={{ flex: 1 }} onPress={() => setConfirmDelete(false)}>{t("common.cancel")}</Button><Button variant="danger" style={{ flex: 1 }} loading={remove.isPending} onPress={deleteTemplate}>{t("templates.delete")}</Button></View>}>
        <Text tone="muted" style={{ paddingBottom: 12 }}>{t("templates.deleteMessage")}</Text>
        {error ? <Text tone="pink" style={{ marginTop: 8 }}>{error}</Text> : null}
      </BottomSheet>
    </Screen>
  );
}
