import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import type { Equipment } from "@deepgym/core/workout";
import { EQUIPMENT_OPTIONS } from "@deepgym/core/workout";
import { formatWeight, parseWeight, unitToKg } from "@deepgym/core/weight";
import { colors, fonts, radii } from "../theme";
import { BottomSheet, Button, Card, Chip, Screen, Segmented, Text } from "../ui";
import {
  useCreateExercise,
  useCreateTemplate,
  useExercises,
  useMuscleGroups,
  useProfile,
  useTemplates,
} from "../data/queries";
import { useI18n } from "../providers/locale-provider";
import { userErrorMessage } from "../lib/user-error";
import { ErrorState, Header, LoadingState } from "./common";

type LibraryTab = "exercises" | "templates";

export function LibraryScreen() {
  const { t } = useI18n();
  const profile = useProfile();
  const exercises = useExercises();
  const groups = useMuscleGroups();
  const templates = useTemplates();
  const createExercise = useCreateExercise();
  const createTemplate = useCreateTemplate();
  const [tab, setTab] = useState<LibraryTab>("exercises");
  const [search, setSearch] = useState("");
  const [focusGroup, setFocusGroup] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("Full Body");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Equipment>("machine");
  const [weight, setWeight] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const visibleExercises = useMemo(() =>
    (exercises.data ?? []).filter((exercise) =>
      (!focusGroup || exercise.muscle_group_id === focusGroup) &&
      exercise.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    ), [exercises.data, focusGroup, search]);
  const visibleTemplates = (templates.data ?? []).filter((template) =>
    template.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const groupById = new Map((groups.data ?? []).map((group) => [group.id, group.name]));

  function openCreate() {
    setName("");
    setWeight("");
    setGroupId(groups.data?.[0]?.id ?? null);
    setPicked([]);
    setFormError(null);
    setCreateOpen(true);
  }

  async function submitCreate() {
    setFormError(null);
    try {
      if (tab === "exercises") {
        if (!name.trim() || !groupId) {
          setFormError(t(!name.trim() ? "picker.errName" : "picker.errGroup"));
          return;
        }
        const parsed = parseWeight(weight);
        await createExercise.mutateAsync({
          name: name.trim(),
          muscle_group_id: groupId,
          equipment,
          working_weight_kg: parsed == null ? null : unitToKg(parsed, profile.data?.unit ?? "kg"),
          machine_settings: null,
          unit: null,
        });
      } else {
        await createTemplate.mutateAsync({ name: name.trim(), type, exerciseIds: picked });
      }
      setCreateOpen(false);
    } catch (error) {
      setFormError(userErrorMessage(t, error));
    }
  }

  return (
    <Screen bottomPadding={122}>
      <Header
        title={t("nav.library")}
        profile={profile.data}
        action={<Button variant="lime" size="sm" iconOnly onPress={openCreate}>+</Button>}
      />
      <Segmented
        value={tab}
        onChange={(value) => { setTab(value); setSearch(""); }}
        options={[
          { value: "exercises", label: t("exercises.title") },
          { value: "templates", label: t("templates.title") },
        ]}
        style={{ marginTop: 10, marginBottom: 18 }}
      />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={tab === "exercises" ? t("exercises.title") : t("templates.title")}
        placeholderTextColor={colors.faint}
        style={{
          backgroundColor: colors.raised,
          borderRadius: radii.medium,
          borderWidth: 1,
          borderColor: colors.line,
          color: colors.text,
          fontFamily: fonts.regular,
          fontSize: 15,
          paddingHorizontal: 18,
          height: 52,
          marginBottom: 13,
        }}
      />

      {tab === "exercises" ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 18 }}>
            <Chip selected={!focusGroup} onPress={() => setFocusGroup(null)}>{t("common.all")}</Chip>
            {(groups.data ?? []).map((group) => (
              <Chip key={group.id} selected={focusGroup === group.id} onPress={() => setFocusGroup(group.id)}>{group.name}</Chip>
            ))}
          </ScrollView>
          {exercises.isLoading || groups.isLoading ? <LoadingState /> : null}
          {exercises.error ? <ErrorState message={exercises.error.message} retry={() => exercises.refetch()} /> : null}
          {(groups.data ?? []).filter((group) =>
            visibleExercises.some((exercise) => exercise.muscle_group_id === group.id),
          ).map((group) => (
            <View key={group.id} style={{ marginBottom: 20, gap: 9 }}>
              <Text variant="micro" tone="muted" style={{ marginBottom: 2 }}>
                {group.name} · {visibleExercises.filter((exercise) => exercise.muscle_group_id === group.id).length}
              </Text>
              {visibleExercises.filter((exercise) => exercise.muscle_group_id === group.id).map((exercise) => (
                <Pressable
                  key={exercise.id}
                  onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: exercise.id } })}
                >
                  <Card radius={19} padding={16}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text weight="semibold" numberOfLines={1}>{exercise.name}</Text>
                        <Text variant="caption" tone="muted">{t(`equipment.${exercise.equipment}`)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text variant="micro" tone="faint">{t("exercises.working")}</Text>
                        <Text tone="lime" weight="semibold">
                          {formatWeight(exercise.working_weight_kg, exercise.unit ?? profile.data?.unit ?? "kg")}
                        </Text>
                      </View>
                      <Text tone="faint">›</Text>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          ))}
          {!visibleExercises.length && !exercises.isLoading ? (
            <Card><Text tone="muted">{t("exercises.emptyTitle")}</Text></Card>
          ) : null}
        </>
      ) : (
        <View style={{ gap: 10 }}>
          {templates.isLoading ? <LoadingState /> : null}
          {templates.error ? <ErrorState message={templates.error.message} retry={() => templates.refetch()} /> : null}
          {visibleTemplates.map((template) => (
            <Pressable
              key={template.id}
              onPress={() => router.push({ pathname: "/templates/[id]", params: { id: template.id } })}
            >
              <Card radius={20} padding={16}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text weight="semibold">{template.name}</Text>
                    <Text variant="caption" tone="muted">{template.type} · {template.exerciseCount} exercises</Text>
                  </View>
                  <Button
                    variant="lime"
                    size="sm"
                    onPress={() => router.push({ pathname: "/new", params: { template: template.id } })}
                  >
                    {t("templates.start")}
                  </Button>
                </View>
              </Card>
            </Pressable>
          ))}
          {!visibleTemplates.length && !templates.isLoading ? (
            <Card><Text tone="muted">{t("templates.emptyTitle")}</Text></Card>
          ) : null}
        </View>
      )}

      <BottomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tab === "exercises" ? t("workout.addExercise") : t("templates.new")}
        closeLabel={t("common.close")}
        footer={<Button variant="lime" block loading={createExercise.isPending || createTemplate.isPending} onPress={submitCreate}>
          {tab === "exercises" ? t("common.add") : t("templates.create")}
        </Button>}
      >
        <Text variant="micro" tone="muted" style={{ marginBottom: 7 }}>
          {tab === "exercises" ? t("picker.name") : t("templates.name")}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={tab === "exercises" ? t("picker.namePlaceholder") : t("templates.namePlaceholder")}
          placeholderTextColor={colors.faint}
          style={inputStyle}
        />
        {tab === "exercises" ? (
          <>
            <Text variant="micro" tone="muted" style={{ marginBottom: 9 }}>{t("picker.muscleGroup")}</Text>
            <View style={chipWrap}>
              {(groups.data ?? []).map((group) => (
                <Chip key={group.id} selected={groupId === group.id} onPress={() => setGroupId(group.id)}>{group.name}</Chip>
              ))}
            </View>
            <Text variant="micro" tone="muted" style={{ marginBottom: 9 }}>{t("picker.equipment")}</Text>
            <View style={chipWrap}>
              {EQUIPMENT_OPTIONS.map(({ value }) => (
                <Chip key={value} selected={equipment === value} onPress={() => setEquipment(value)}>{t(`equipment.${value}`)}</Chip>
              ))}
            </View>
            {equipment !== "bodyweight" ? (
              <>
                <Text variant="micro" tone="muted" style={{ marginBottom: 7 }}>
                  {t("picker.workingWeight", { unit: profile.data?.unit ?? "kg" })}
                </Text>
                <TextInput value={weight} onChangeText={setWeight} keyboardType="decimal-pad" style={inputStyle} placeholder="0" placeholderTextColor={colors.faint} />
              </>
            ) : null}
          </>
        ) : (
          <>
            <Text variant="micro" tone="muted" style={{ marginBottom: 9 }}>{t("workout.type")}</Text>
            <View style={chipWrap}>
              {["Upper", "Lower", "Full Body", "Push", "Pull"].map((value) => (
                <Chip key={value} selected={type === value} onPress={() => setType(value)}>{value}</Chip>
              ))}
            </View>
            <Text variant="micro" tone="muted" style={{ marginBottom: 9 }}>{t("templates.exercises")}</Text>
            <View style={{ gap: 6, marginBottom: 12 }}>
              {(exercises.data ?? []).map((exercise) => (
                <Pressable
                  key={exercise.id}
                  onPress={() => setPicked((current) => current.includes(exercise.id)
                    ? current.filter((id) => id !== exercise.id)
                    : [...current, exercise.id])}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 11, backgroundColor: colors.raised, borderRadius: 12 }}
                >
                  <Text tone={picked.includes(exercise.id) ? "lime" : "muted"}>{picked.includes(exercise.id) ? "●" : "○"}</Text>
                  <Text>{exercise.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {formError ? <Text tone="pink" style={{ marginBottom: 8 }}>{formError}</Text> : null}
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
