import { useState } from "react";
import { TextInput, View } from "react-native";
import type { Exercise, MuscleGroup } from "@deepgym/core/types";
import { EQUIPMENT_OPTIONS, type Equipment } from "@deepgym/core/workout";
import { parseWeight, unitToKg, type Unit } from "@deepgym/core/weight";
import { useCreateExercise } from "../data/queries";
import { useI18n } from "../providers/locale-provider";
import { userErrorMessage } from "../lib/user-error";
import { colors, fonts, radii } from "../theme";
import { Button, Chip, Text } from "../ui";

interface InlineExerciseCreateProps {
  groups: MuscleGroup[];
  profileUnit: Unit;
  defaultGroupId: string | null;
  onCreated: (exercise: Exercise) => void;
  onCancel: () => void;
}

/** The picker stays over the workout draft, so creating an exercise never loses entered sets. */
export function InlineExerciseCreate({
  groups,
  profileUnit,
  defaultGroupId,
  onCreated,
  onCancel,
}: InlineExerciseCreateProps) {
  const { t } = useI18n();
  const createExercise = useCreateExercise();
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState(defaultGroupId ?? groups[0]?.id ?? null);
  const [equipment, setEquipment] = useState<Equipment>("free_weight");
  const [machineSettings, setMachineSettings] = useState("");
  const [weight, setWeight] = useState("");
  const [unitChoice, setUnitChoice] = useState<"default" | Unit>("default");
  const [error, setError] = useState<string | null>(null);
  const effectiveUnit = unitChoice === "default" ? profileUnit : unitChoice;

  async function submit() {
    const trimmed = name.trim();
    const selectedGroup = groups.find((group) => group.id === groupId) ?? groups[0];
    if (!trimmed) return setError(t("picker.errName"));
    if (!selectedGroup) return setError(t("picker.errGroup"));

    const parsedWeight = parseWeight(weight);
    setError(null);
    try {
      const exercise = await createExercise.mutateAsync({
        name: trimmed,
        muscle_group_id: selectedGroup.id,
        equipment,
        machine_settings: equipment === "machine" ? machineSettings.trim() || null : null,
        working_weight_kg: equipment === "bodyweight" || parsedWeight == null
          ? null
          : Math.round(unitToKg(parsedWeight, effectiveUnit) * 100) / 100,
        unit: unitChoice === "default" ? null : unitChoice,
      });
      onCreated(exercise);
    } catch (failure) {
      setError(userErrorMessage(t, failure));
    }
  }

  return (
    <View>
      <Text variant="micro" tone="muted" style={labelStyle}>{t("picker.name")}</Text>
      <TextInput
        autoFocus
        value={name}
        onChangeText={setName}
        placeholder={t("picker.namePlaceholder")}
        placeholderTextColor={colors.faint}
        style={inputStyle}
      />

      <Text variant="micro" tone="muted" style={labelStyle}>{t("picker.muscleGroup")}</Text>
      <View style={chipsStyle}>
        {groups.map((group) => (
          <Chip key={group.id} selected={groupId === group.id} onPress={() => setGroupId(group.id)}>
            {group.name}
          </Chip>
        ))}
      </View>

      <Text variant="micro" tone="muted" style={labelStyle}>{t("picker.equipment")}</Text>
      <View style={chipsStyle}>
        {EQUIPMENT_OPTIONS.map(({ value }) => (
          <Chip key={value} selected={equipment === value} onPress={() => setEquipment(value)}>
            {t(`equipment.${value}`)}
          </Chip>
        ))}
      </View>

      {equipment === "machine" ? (
        <>
          <Text variant="micro" tone="muted" style={labelStyle}>{t("picker.machineSetupOptional")}</Text>
          <TextInput
            value={machineSettings}
            onChangeText={setMachineSettings}
            placeholder={t("picker.machineSetupPlaceholder")}
            placeholderTextColor={colors.faint}
            multiline
            style={[inputStyle, { minHeight: 78, textAlignVertical: "top" }]}
          />
        </>
      ) : null}

      <Text variant="micro" tone="muted" style={labelStyle}>{t("picker.unitForExercise")}</Text>
      <View style={chipsStyle}>
        {(["default", "kg", "lb"] as const).map((value) => (
          <Chip key={value} selected={unitChoice === value} onPress={() => setUnitChoice(value)}>
            {value === "default" ? t("picker.unitDefault", { unit: profileUnit }) : value}
          </Chip>
        ))}
      </View>

      {equipment !== "bodyweight" ? (
        <>
          <Text variant="micro" tone="muted" style={labelStyle}>
            {t("picker.workingWeight", { unit: effectiveUnit })}
          </Text>
          <TextInput
            value={weight}
            onChangeText={(value) => setWeight(value.replace(/[^\d.,]/g, ""))}
            placeholder="60"
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            style={inputStyle}
          />
        </>
      ) : null}

      {error ? <Text tone="pink" style={{ marginBottom: 14 }}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Button variant="surface" onPress={onCancel} style={{ flex: 1 }}>{t("common.back")}</Button>
        <Button variant="lime" loading={createExercise.isPending} onPress={submit} style={{ flex: 1 }}>
          {t("picker.createAdd")}
        </Button>
      </View>
    </View>
  );
}

const labelStyle = { marginBottom: 8 };
const chipsStyle = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginBottom: 18 };
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
  marginBottom: 17,
};
