import { Ionicons } from "@expo/vector-icons";
import { translateCount } from "@deepgym/core/i18n";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import type { Equipment } from "@deepgym/core/workout";
import { EQUIPMENT_OPTIONS } from "@deepgym/core/workout";
import { formatWeight, parseWeight, unitToKg, type Unit } from "@deepgym/core/weight";
import { colors, fonts, radii } from "../theme";
import { BottomSheet, Button, Card, Chip, DotValue, Screen, Segmented, Text } from "../ui";
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
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ tab?: string; create?: string }>();
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
  const [equipment, setEquipment] = useState<Equipment>("free_weight");
  const [weight, setWeight] = useState("");
  const [machineSettings, setMachineSettings] = useState("");
  const [unitChoice, setUnitChoice] = useState<"default" | Unit>("default");
  const [picked, setPicked] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const pendingCreatedDetail = useRef<{ kind: "exercise" | "template"; id: string } | null>(null);

  useEffect(() => {
    if (params.tab === "exercises" || params.tab === "templates") {
      setTab(params.tab);
      setSearch("");
    }
  }, [params.tab]);

  useEffect(() => {
    if (params.create !== "1") return;
    setTab("templates");
    setSearch("");
    setName("");
    setPicked([]);
    setFormError(null);
    setCreateOpen(true);
    router.setParams({ tab: "templates", create: "0" });
  }, [params.create]);

  const visibleExercises = useMemo(() =>
    (exercises.data ?? []).filter((exercise) =>
      (!focusGroup || exercise.muscle_group_id === focusGroup) &&
      exercise.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    ), [exercises.data, focusGroup, search]);
  const visibleTemplates = (templates.data ?? []).filter((template) =>
    template.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const displayUnit = profile.data?.unit ?? "kg";
  const effectiveUnit = unitChoice === "default" ? displayUnit : unitChoice;

  function openCreate() {
    setName("");
    setWeight("");
    setGroupId(focusGroup ?? groups.data?.[0]?.id ?? null);
    setEquipment("free_weight");
    setMachineSettings("");
    setUnitChoice("default");
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
        const created = await createExercise.mutateAsync({
          name: name.trim(),
          muscle_group_id: groupId,
          equipment,
          working_weight_kg: equipment === "bodyweight" || parsed == null
            ? null : Math.round(unitToKg(parsed, effectiveUnit) * 100) / 100,
          machine_settings: equipment === "machine" ? machineSettings.trim() || null : null,
          unit: unitChoice === "default" ? null : unitChoice,
        });
        pendingCreatedDetail.current = { kind: "exercise", id: created.id };
        setCreateOpen(false);
      } else {
        const id = await createTemplate.mutateAsync({ name: name.trim(), type, exerciseIds: picked });
        pendingCreatedDetail.current = { kind: "template", id };
        setCreateOpen(false);
      }
    } catch (error) {
      setFormError(userErrorMessage(t, error));
    }
  }

  return (
    <Screen bottomPadding={122}>
      <Header
        title={t("nav.library")}
        profile={profile.data}
        action={<Button variant="lime" size="sm" iconOnly onPress={openCreate} accessibilityLabel={tab === "exercises" ? t("picker.createNew") : t("templates.new")}><Ionicons name="add" size={20} color={colors.black} /></Button>}
      />
      <Segmented
        accessibilityLabel={t("nav.library")}
        value={tab}
        onChange={(next) => { setTab(next); setSearch(""); router.setParams({ tab: next }); }}
        options={[
          { value: "exercises", label: t("exercises.title") },
          { value: "templates", label: t("templates.title") },
        ]}
        style={{ marginTop: 20, marginBottom: 18 }}
      />
      {tab === "exercises" ? (
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("picker.search")}
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
      ) : null}

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
            <View key={group.id} style={{ marginBottom: 24, gap: 8 }}>
              <Text tone="muted" weight="semibold" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.32, textTransform: "uppercase", marginBottom: 2 }}>
                {group.name} · {visibleExercises.filter((exercise) => exercise.muscle_group_id === group.id).length}
              </Text>
              {visibleExercises.filter((exercise) => exercise.muscle_group_id === group.id).map((exercise) => (
                <Pressable
                  key={exercise.id}
                  onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: exercise.id } })}
                >
                  <Card radius={radii.tile} padding={14}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text weight="medium" numberOfLines={1}>{exercise.name}</Text>
                        <View style={{ alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised }}>
                          <Text variant="caption" tone="muted">{t(`equipment.${exercise.equipment}`)}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text variant="micro" tone="faint" style={{ fontSize: 10, letterSpacing: 0.3 }}>{exercise.equipment === "bodyweight" ? t("bodyWeight.title") : t("exercises.working")}</Text>
                        <DotValue
                          value={exercise.equipment === "bodyweight"
                            ? profile.data?.body_weight_kg == null ? "—" : formatWeight(profile.data.body_weight_kg, exercise.unit ?? displayUnit).replace(` ${exercise.unit ?? displayUnit}`, "")
                            : exercise.working_weight_kg == null ? "—" : formatWeight(exercise.working_weight_kg, exercise.unit ?? displayUnit).replace(` ${exercise.unit ?? displayUnit}`, "")}
                          suffix={(exercise.equipment === "bodyweight" ? profile.data?.body_weight_kg : exercise.working_weight_kg) == null ? undefined : exercise.unit ?? displayUnit}
                          size={20}
                          color={colors.lime}
                        />
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          ))}
          {!visibleExercises.length && !exercises.isLoading ? (
            <Card><Text weight="semibold">{t("exercises.emptyTitle")}</Text><Text tone="muted" style={{ marginTop: 7 }}>{t("exercises.emptyHint")}</Text></Card>
          ) : null}
        </>
      ) : (
        <View style={{ gap: 10 }}>
          {templates.isLoading ? <LoadingState /> : null}
          {templates.error ? <ErrorState message={templates.error.message} retry={() => templates.refetch()} /> : null}
          {visibleTemplates.map((template) => (
            <Card key={template.id} radius={radii.tile} padding={6}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable
                  onPress={() => router.push({ pathname: "/templates/[id]", params: { id: template.id } })}
                  accessibilityRole="button"
                  style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, padding: 10 }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="semibold" numberOfLines={1}>{template.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
                      <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised }}>
                        <Text variant="caption" tone="muted">{template.type}</Text>
                      </View>
                      <Text variant="caption" tone="muted">{translateCount(lang, "count.exercises", template.exerciseCount)}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                </Pressable>
                <Button variant="lime" size="sm" leading={<Ionicons name="play" size={13} color={colors.black} />} onPress={() => router.push({ pathname: "/new", params: { template: template.id } })}>{t("templates.start")}</Button>
              </View>
            </Card>
          ))}
          {!visibleTemplates.length && !templates.isLoading ? (
            <Card><Text weight="semibold">{t("templates.emptyTitle")}</Text><Text tone="muted" style={{ marginTop: 7 }}>{t("templates.emptyHint")}</Text></Card>
          ) : null}
        </View>
      )}

      <BottomSheet
        open={createOpen}
        onClose={() => {
          pendingCreatedDetail.current = null;
          setCreateOpen(false);
        }}
        onClosed={() => {
          const destination = pendingCreatedDetail.current;
          pendingCreatedDetail.current = null;
          if (!destination) return;
          if (destination.kind === "exercise") {
            router.push({ pathname: "/exercises/[id]", params: { id: destination.id } });
          } else {
            router.push({ pathname: "/templates/[id]", params: { id: destination.id } });
          }
        }}
        title={tab === "exercises" ? t("picker.newTitle") : t("templates.new")}
        closeLabel={t("common.close")}
        footer={<Button variant="lime" block loading={createExercise.isPending || createTemplate.isPending} onPress={submitCreate}>
          {tab === "exercises" ? t("picker.createNew") : t("templates.create")}
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
            {equipment === "machine" ? (
              <>
                <Text variant="micro" tone="muted" style={{ marginBottom: 7 }}>{t("picker.machineSetupOptional")}</Text>
                <TextInput value={machineSettings} onChangeText={setMachineSettings} multiline textAlignVertical="top" style={[inputStyle, { minHeight: 98 }]} placeholder={t("picker.machineSetupPlaceholder")} placeholderTextColor={colors.faint} />
              </>
            ) : null}
            <Text variant="micro" tone="muted" style={{ marginBottom: 9 }}>{t("picker.unitForExercise")}</Text>
            <View style={chipWrap}>
              <Chip selected={unitChoice === "default"} onPress={() => setUnitChoice("default")}>{t("picker.unitDefault", { unit: displayUnit })}</Chip>
              <Chip selected={unitChoice === "kg"} onPress={() => setUnitChoice("kg")}>kg</Chip>
              <Chip selected={unitChoice === "lb"} onPress={() => setUnitChoice("lb")}>lb</Chip>
            </View>
            {equipment !== "bodyweight" ? (
              <>
                <Text variant="micro" tone="muted" style={{ marginBottom: 7 }}>
                  {t("picker.workingWeight", { unit: effectiveUnit })}
                </Text>
                <TextInput value={weight} onChangeText={(value) => setWeight(value.replace(/[^\d.,]/g, ""))} keyboardType="decimal-pad" style={inputStyle} placeholder="60" placeholderTextColor={colors.faint} />
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
