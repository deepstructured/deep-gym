import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { BASE_WORKOUT_TYPES } from "@deepgym/core/workout";
import { translateCount } from "@deepgym/core/i18n";
import { colors, fonts, radii } from "../theme";
import { BottomSheet, Button, Card, Chip, Screen, Text } from "../ui";
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
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [exerciseIds, setExerciseIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const template = query.data;
  const groupName = new Map((groups.data ?? []).map((group) => [group.id, group.name]));

  function openEditor() {
    if (!template) return;
    setName(template.name);
    setType(template.type);
    setExerciseIds(template.workout_template_exercises.map((entry) => entry.exercise_id));
    setError(null);
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

  function confirmDelete() {
    if (!template) return;
    Alert.alert(t("templates.deleteTitle"), t("templates.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("templates.delete"), style: "destructive",
        onPress: () => remove.mutate(template.id, {
          onSuccess: () => router.replace("/library"),
          onError: (failure) => Alert.alert(t("common.error"), userErrorMessage(t, failure)),
        }),
      },
    ]);
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
        action={template ? <Button size="sm" variant="surface" onPress={openEditor}>{t("templates.edit")}</Button> : null}
      />
      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message={query.error.message} retry={() => query.refetch()} /> : null}
      {!query.isLoading && !query.error && !template ? (
        <ErrorState message={t("templates.notFound")} translated />
      ) : null}
      {template ? (
        <View style={{ gap: 13, paddingTop: 18 }}>
          <Card variant="live" padding={20}>
            <Text variant="micro" tone="lime">{template.type}</Text>
            <Text variant="heading" style={{ marginTop: 12 }}>{template.name}</Text>
            <Text tone="muted" style={{ marginTop: 6 }}>
              {translateCount(lang, "count.exercises", template.workout_template_exercises.length)}
            </Text>
          </Card>

          <Text variant="micro" tone="muted" style={{ marginTop: 20 }}>
            {t("templates.exercises")}
          </Text>
          {template.workout_template_exercises.length ? template.workout_template_exercises.map((entry, index) => (
            <Pressable
              key={entry.id}
              onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: entry.exercise_id } })}
            >
              <Card radius={19} padding={16}>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <Text variant="micro" tone="lime">{String(index + 1).padStart(2, "0")}</Text>
                  <View style={{ flex: 1 }}>
                    <Text weight="semibold">{entry.exercise?.name ?? t("exercises.title")}</Text>
                    <Text variant="caption" tone="muted">
                      {groupName.get(entry.exercise?.muscle_group_id ?? "") ?? ""}
                      {entry.exercise ? ` · ${t(`equipment.${entry.exercise.equipment}`)}` : ""}
                    </Text>
                  </View>
                  <Text tone="faint">›</Text>
                </View>
              </Card>
            </Pressable>
          )) : <Card><Text tone="muted">{t("templates.emptyExercises")}</Text></Card>}

          <Button
            variant="gradient" size="lg" block
            disabled={!template.workout_template_exercises.length}
            onPress={() => router.push({ pathname: "/new", params: { template: template.id } })}
            style={{ marginTop: 18 }}
          >
            {t("templates.startWorkout")}
          </Button>
          <Button variant="danger" size="lg" block loading={remove.isPending} onPress={confirmDelete}>
            {t("templates.delete")}
          </Button>
        </View>
      ) : null}

      <BottomSheet
        open={editing}
        onClose={() => setEditing(false)}
        closeLabel={t("common.close")}
        title={t("templates.edit")}
        footer={<Button variant="lime" size="lg" block loading={update.isPending} onPress={save}>{t("common.saveChanges")}</Button>}
      >
        <View style={{ gap: 13, paddingBottom: 12 }}>
          <Text variant="micro" tone="muted">{t("templates.name")}</Text>
          <TextInput value={name} onChangeText={setName} style={inputStyle} placeholder={t("templates.namePlaceholder")} placeholderTextColor={colors.faint} />
          <Text variant="micro" tone="muted">{t("workout.type")}</Text>
          <TextInput value={type} onChangeText={setType} style={inputStyle} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {BASE_WORKOUT_TYPES.map((value) => <Chip key={value} selected={type === value} onPress={() => setType(value)}>{value}</Chip>)}
          </View>
          <Text variant="micro" tone="muted" style={{ marginTop: 12 }}>{t("templates.exercises")}</Text>
          {exerciseIds.map((exerciseId, index) => {
            const exercise = exercises.data?.find((candidate) => candidate.id === exerciseId);
            return (
              <Card key={`${exerciseId}-${index}`} radius={15} padding={10}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ flex: 1 }}>{exercise?.name ?? exerciseId}</Text>
                  <Button size="sm" iconOnly onPress={() => move(index, -1)} disabled={index === 0}>↑</Button>
                  <Button size="sm" iconOnly onPress={() => move(index, 1)} disabled={index === exerciseIds.length - 1}>↓</Button>
                  <Button size="sm" iconOnly variant="danger" onPress={() => setExerciseIds((ids) => ids.filter((_, position) => position !== index))}>×</Button>
                </View>
              </Card>
            );
          })}
          {(exercises.data ?? []).filter((exercise) => !exerciseIds.includes(exercise.id)).map((exercise) => (
            <Pressable key={exercise.id} onPress={() => setExerciseIds((ids) => [...ids, exercise.id])}>
              <Card variant="raised" radius={14} padding={12}>
                <Text>{exercise.name} <Text tone="lime">+</Text></Text>
              </Card>
            </Pressable>
          ))}
          {error ? <Text tone="pink">{error}</Text> : null}
        </View>
      </BottomSheet>
    </Screen>
  );
}
