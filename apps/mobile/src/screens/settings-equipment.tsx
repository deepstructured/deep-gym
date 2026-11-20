import { Ionicons } from "@expo/vector-icons";
import { buildPlateSpecs, parseSignedWeight, type Unit } from "@deepgym/core/weight";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useI18n } from "../providers/locale-provider";
import { colors, fonts, radii } from "../theme";
import { Button, Segmented, Text } from "../ui";

export function SettingInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  onBlur,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "numbers-and-punctuation";
  onBlur?: () => void;
  maxLength?: number;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="caption" tone="muted">{label}</Text>
      <TextInput
        value={value}
        maxLength={maxLength}
        accessibilityLabel={label}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
        selectionColor={colors.lime}
        style={{
          minHeight: 49,
          borderRadius: 13,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.raised,
          color: colors.text,
          fontFamily: fonts.regular,
          fontSize: 16,
          paddingHorizontal: 15,
        }}
      />
    </View>
  );
}

export function PlateFields({ unit, platesKg, platesLb, onChange, pending, limited = false }: {
  unit: Unit;
  platesKg: number[];
  platesLb: number[];
  onChange: (unit: Unit, values: number[]) => void | Promise<unknown>;
  pending: boolean;
  limited?: boolean;
}) {
  const { t } = useI18n();
  const [plateDraft, setPlateDraft] = useState("");
  const [plateUnit, setPlateUnit] = useState(unit);
  const [failed, setFailed] = useState(false);
  const plates = buildPlateSpecs(platesKg, platesLb);
  const current = plateUnit === "kg" ? platesKg : platesLb;
  const value = parseSignedWeight(plateDraft);
  const valid = value != null && value > 0 && (!limited || (value <= 1000 && (current.includes(value) || current.length < 50)));

  async function addPlate() {
    if (!valid) return;
    try {
      if (!current.includes(value)) await onChange(plateUnit, [...current, value]);
      setPlateDraft("");
      setFailed(false);
    } catch { setFailed(true); }
  }

  async function removePlate(weight: number, denomination: Unit) {
    const values = denomination === "kg" ? platesKg : platesLb;
    try {
      await onChange(denomination, values.filter(item => item !== weight));
      setFailed(false);
    } catch { setFailed(true); }
  }

  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {plates.map((plate) => (
          <Pressable key={`${plate.unit}-${plate.value}`} onPress={() => removePlate(plate.value, plate.unit)} disabled={pending}
            accessibilityRole="button"
            accessibilityLabel={t("settings.removePlate", { plate: `${plate.value} ${plate.unit}` })}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 14, paddingRight: 9, minHeight: 36, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised }}>
            <Text style={{ fontFamily: fonts.dot, fontSize: 15, lineHeight: 20 }}>{plate.value}</Text><Text variant="caption" tone="muted">{plate.unit}</Text>
            <Ionicons name="close" size={14} color={colors.faint} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TextInput
          value={plateDraft}
          accessibilityLabel={t("settings.plateWeight")}
          onChangeText={setPlateDraft}
          placeholder={t("settings.plateWeight")}
          placeholderTextColor={colors.faint}
          keyboardType="decimal-pad"
          selectionColor={colors.lime}
          style={{ flex: 1, height: 40, borderRadius: radii.small, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised, color: colors.text, fontFamily: fonts.regular, fontSize: 14, paddingHorizontal: 13 }}
        />
        <Segmented options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} value={plateUnit} onChange={setPlateUnit} style={{ width: 98 }} />
        <Button variant="surface" size="compact" leading={<Ionicons name="add" size={16} color={colors.text} />} disabled={!valid} onPress={addPlate} loading={pending}>{t("common.add")}</Button>
      </View>
      {failed && <Text tone="pink">{t("common.error")}</Text>}
    </>
  );
}
