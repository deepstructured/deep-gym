import { TextInput, View } from "react-native";
import { kgToUnit, parseSignedWeight, roundWeight, type Unit } from "@deepgym/core/weight";
import { colors, fonts, radii } from "../theme";
import { Text } from "../ui";
import { useI18n } from "../providers/locale-provider";

interface WorkoutBodyweightLoadProps {
  bodyWeightKg: number | null;
  unit: Unit;
  addedWeight: string;
  warmup?: boolean;
  editable?: boolean;
  onChange: (value: string) => void;
}

/** Compact bodyweight equation used by the PWA's set rows. */
export function WorkoutBodyweightLoad({ bodyWeightKg, unit, addedWeight, warmup, editable = true, onChange }: WorkoutBodyweightLoadProps) {
  const { t } = useI18n();
  const base = bodyWeightKg == null ? null : roundWeight(kgToUnit(bodyWeightKg, unit));
  const added = parseSignedWeight(addedWeight) ?? 0;
  const total = base == null ? null : roundWeight(base + added);
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", flexShrink: 0, gap: 2 }}>
          <Text tone="muted" style={{ fontFamily: fonts.dot, fontSize: 12 }}>{base ?? "—"}</Text>
          <Text tone="muted" style={{ fontSize: 9 }}>{unit}</Text>
        </View>
        <Text tone="faint" style={{ fontSize: 12 }}>+</Text>
        <TextInput
          editable={editable}
          value={addedWeight}
          onChangeText={(value) => {
            const next = value.replace(/\s/g, "");
            if (/^[+-]?\d*(?:[.,]\d*)?$/.test(next)) onChange(next);
          }}
          keyboardType="numbers-and-punctuation"
          placeholder="0"
          placeholderTextColor={colors.faint}
          accessibilityLabel={t("set.addedLoad", { unit })}
          style={{ flex: 1, minWidth: 0, height: 38, borderRadius: radii.medium, paddingHorizontal: 7, borderWidth: 1, borderColor: warmup ? "rgba(64,84,214,0.18)" : colors.line, backgroundColor: warmup ? "rgba(24,39,136,0.12)" : colors.raised, color: colors.text, fontFamily: fonts.regular, fontSize: 15 }}
        />
      </View>
      <Text tone="faint" numberOfLines={1} style={{ textAlign: "right", fontSize: 9, marginTop: 2 }}>
        {t("set.totalLoad")}: {total ?? "—"} {unit}
      </Text>
    </View>
  );
}
