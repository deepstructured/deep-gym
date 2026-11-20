import { Ionicons } from "@expo/vector-icons";
import { filterExercisesByGym } from "@deepgym/core/gym-data";
import { translateCount } from "@deepgym/core/i18n";
import type { Gym, GymInput, Profile } from "@deepgym/core/types";
import { kgToUnit, parseSignedWeight, roundWeight, unitToKg } from "@deepgym/core/weight";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useDeleteGym, useGyms, useSaveGym } from "../data/gyms";
import { useExercises } from "../data/queries";
import { useI18n } from "../providers/locale-provider";
import { colors, radii } from "../theme";
import { BottomSheet, Button, Text } from "../ui";
import { ErrorState, LoadingState } from "./common";
import { PlateFields, SettingInput } from "./settings-equipment";

type GymDraft = GymInput & { id?: string; barText: string; initialBarText: string };

function makeDraft(profile: Profile, gym?: Gym): GymDraft {
  const gear = gym ?? profile;
  const barText = String(roundWeight(kgToUnit(gear.bar_weight_kg, profile.unit)));
  return {
    id: gym?.id, name: gym?.name ?? "", exercise_ids: gym?.exercise_ids ?? [],
    plates_kg: gear.plates_kg, plates_lb: gear.plates_lb ?? [], bar_weight_kg: gear.bar_weight_kg,
    barText, initialBarText: barText,
  };
}

export function GymSettingsSheet({ profile, initialGymId, onClose }: {
  profile: Profile;
  initialGymId?: string;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const gyms = useGyms();
  const saveGym = useSaveGym();
  const deleteGym = useDeleteGym();
  const exercises = useExercises();
  const deepLink = useRef(initialGymId);
  const [draft, setDraft] = useState<GymDraft | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [section, setSection] = useState<"equipment" | "exercises" | null>(null);
  const pending = saveGym.isPending || deleteGym.isPending;

  useEffect(() => {
    if (!deepLink.current || !gyms.data) return;
    const gym = gyms.data.find(row => row.id === deepLink.current);
    deepLink.current = undefined;
    if (gym) setDraft(makeDraft(profile, gym));
    else setError(t("gym.unavailable"));
  }, [gyms.data, profile, t]);

  function edit(gym?: Gym) {
    setError("");
    setSearch("");
    setSection(null);
    setDraft(makeDraft(profile, gym));
  }

  function back() {
    setError("");
    setDraft(null);
  }

  function patchDraft(patch: Partial<GymDraft>) {
    setDraft(current => current ? { ...current, ...patch } : null);
    setError("");
  }

  const duplicate = draft && gyms.data?.some(gym => gym.id !== draft.id &&
    gym.name.toLocaleLowerCase(lang) === draft.name.trim().toLocaleLowerCase(lang));
  const displayedBar = draft ? parseSignedWeight(draft.barText) : null;
  const barKg = draft && draft.barText === draft.initialBarText
    ? draft.bar_weight_kg
    : displayedBar == null ? null : Math.round(unitToKg(displayedBar, profile.unit) * 100) / 100;
  const validBar = barKg != null && barKg >= 0 && barKg <= 1000;
  const canSave = Boolean(draft?.name.trim() && validBar && !duplicate && !pending);

  async function save() {
    if (!draft || barKg == null || !canSave) return;
    try {
      await saveGym.mutateAsync({
        id: draft.id,
        input: {
          name: draft.name.trim(), bar_weight_kg: barKg, plates_kg: draft.plates_kg,
          plates_lb: draft.plates_lb, exercise_ids: draft.exercise_ids,
        },
      });
      back();
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
      setError(t(code === "23505" ? "gym.duplicate" : "gym.saveError"));
    }
  }

  function remove() {
    const id = draft?.id;
    if (!id || pending) return;
    const gym = gyms.data?.find(item => item.id === id);
    Alert.alert(t("gym.remove"), t("gym.removeConfirm", { name: gym?.name ?? draft.name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"), style: "destructive",
        onPress: () => deleteGym.mutate(id, {
          onSuccess: back,
          onError: () => setError(t("gym.removeError")),
        }),
      },
    ]);
  }

  const term = search.trim().toLocaleLowerCase(lang);
  const matching = exercises.data?.filter(item => item.name.toLocaleLowerCase(lang).includes(term)) ?? [];
  const availableCount = draft && exercises.data?.filter(exercise =>
    exercise.is_universal !== false || draft.exercise_ids.includes(exercise.id)).length;
  const message = duplicate ? t("gym.duplicate") : error;

  return (
    <BottomSheet
      open
      onClose={() => { if (!pending) onClose(); }}
      title={t(draft ? (draft.id ? "gym.edit" : "gym.new") : "gym.title")}
      closeLabel={t("common.close")}
      contentStyle={styles.content}
      footer={draft ? (
        <View style={styles.actions}>
          <Button variant="surface" disabled={pending} onPress={back} style={{ flex: 1 }}>{t("common.cancel")}</Button>
          <Button variant="lime" disabled={!canSave} loading={saveGym.isPending} onPress={save} style={{ flex: 1 }}>{t("common.save")}</Button>
        </View>
      ) : gyms.data && <Button variant="lime" block onPress={() => edit()}>{t("gym.new")}</Button>}
    >
      {draft ? (
        <View pointerEvents={pending ? "none" : "auto"} style={styles.content}>
          <SettingInput label={t("gym.name")} value={draft.name} maxLength={100} onChangeText={name => patchDraft({ name })} />
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: section === "equipment" }}
            onPress={() => setSection(section === "equipment" ? null : "equipment")} style={styles.row}>
            <Text weight="semibold" style={styles.rowLabel}>{t("gym.inventory")}</Text>
            <Ionicons name={section === "equipment" ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
          </Pressable>
          {section === "equipment" && <>
            <SettingInput label={t("settings.barWeight", { unit: profile.unit })} value={draft.barText}
              onChangeText={barText => patchDraft({ barText })} keyboardType="decimal-pad" />
            {!validBar && <Text tone="pink">{t("gym.invalidBar", { max: roundWeight(kgToUnit(1000, profile.unit)), unit: profile.unit })}</Text>}
            <PlateFields unit={profile.unit} platesKg={draft.plates_kg} platesLb={draft.plates_lb} pending={pending} limited
              onChange={(unit, values) => patchDraft(unit === "kg" ? { plates_kg: values } : { plates_lb: values })} />
          </>}
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: section === "exercises" }}
            onPress={() => setSection(section === "exercises" ? null : "exercises")} style={styles.row}>
            <Text weight="semibold" style={styles.rowLabel}>{t("gym.chooseExercises")}</Text>
            {availableCount != null && <Text variant="caption" tone="muted">{availableCount}</Text>}
            <Ionicons name={section === "exercises" ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
          </Pressable>
          {section === "exercises" && <>
            <Text variant="caption" tone="muted">{t("gym.universalHint")}</Text>
            <SettingInput label={t("picker.search")} value={search} onChangeText={setSearch} />
            {exercises.isLoading && <LoadingState />}
            {exercises.isError && <ErrorState message={t("common.error")} translated retry={() => void exercises.refetch()} />}
            {exercises.data && !matching.length && <Text tone="muted">{t("gym.noMatching")}</Text>}
            {matching.map(exercise => {
              const universal = exercise.is_universal !== false;
              const selected = universal || draft.exercise_ids.includes(exercise.id);
              return (
                <Pressable key={exercise.id} style={styles.row} accessibilityRole="checkbox" disabled={universal} accessibilityState={{ checked: selected, disabled: universal }}
                  onPress={() => patchDraft({ exercise_ids: selected
                    ? draft.exercise_ids.filter(id => id !== exercise.id)
                    : [...draft.exercise_ids, exercise.id] })}>
                  <View style={styles.rowLabel}>
                    <Text weight="medium">{exercise.name}</Text>
                    <Text variant="caption" tone="muted">{universal ? t("gym.universal") : t(`equipment.${exercise.equipment}`)}</Text>
                  </View>
                  <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected && !universal ? colors.lime : colors.muted} />
                </Pressable>
              );
            })}
          </>}
          {draft.id && <Button variant="danger" disabled={pending} loading={deleteGym.isPending} onPress={remove}>{t("gym.remove")}</Button>}
        </View>
      ) : (
        <>
          {gyms.isLoading && <LoadingState />}
          {gyms.isError && <ErrorState message={t("gym.loadError")} translated retry={() => void gyms.refetch()} />}
          {gyms.data?.length === 0 && <Text tone="muted">{t("gym.empty")}</Text>}
          {gyms.data?.map(gym => (
            <Pressable key={gym.id} accessibilityRole="button" style={styles.row} onPress={() => edit(gym)}>
              <View style={styles.rowLabel}>
                <Text weight="semibold">{gym.name}</Text>
                {exercises.data && <Text variant="caption" tone="muted">{translateCount(lang, "count.exercises", filterExercisesByGym(exercises.data, [gym], gym.id).length)}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </>
      )}
      {message && <Text tone="pink" accessibilityRole="alert">{message}</Text>}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 6 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11,
    minHeight: 50, backgroundColor: colors.raised, borderRadius: radii.small,
  },
  rowLabel: { flex: 1, gap: 3 },
  actions: { flexDirection: "row", gap: 10 },
});
