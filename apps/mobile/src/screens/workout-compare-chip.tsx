import { View } from "react-native";
import { kgToUnit, roundWeight, type Unit } from "@deepgym/core/weight";
import { colors, fonts, radii } from "../theme";
import { Text } from "../ui";
import { useI18n } from "../providers/locale-provider";
import { WorkoutGlyph } from "./workout-glyphs";

interface WorkoutCompareChipProps {
  weight: string;
  reps: string;
  unit: Unit;
  warmup?: boolean;
  toFailure?: boolean;
  bodyWeightKg?: number | null;
  totalWeightKg?: number | null;
}

/** Set chip with the PWA's dot values and bodyweight equation. */
export function WorkoutCompareChip({ weight, reps, unit, warmup, toFailure, bodyWeightKg, totalWeightKg }: WorkoutCompareChipProps) {
  const { t } = useI18n();
  const showBodyweight = bodyWeightKg != null && totalWeightKg != null;
  const base = showBodyweight ? roundWeight(kgToUnit(bodyWeightKg, unit)) : null;
  const added = showBodyweight ? roundWeight(kgToUnit(totalWeightKg - bodyWeightKg, unit)) : null;
  const total = showBodyweight ? roundWeight(kgToUnit(totalWeightKg, unit)) : null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, borderRadius: radii.pill, borderWidth: 1, borderColor: warmup ? "rgba(64,84,214,0.3)" : colors.line, backgroundColor: warmup ? "rgba(24,39,136,0.2)" : colors.raised, paddingHorizontal: 10, paddingVertical: 5 }}>
      {warmup ? <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: "#aeb8ff" }}>{t("set.warmupShort")}</Text> : null}
      {showBodyweight ? (
        <>
          <Text style={{ fontFamily: fonts.dot, fontSize: 12 }}>{base}</Text>
          <Text tone="muted" style={{ fontFamily: fonts.dot, fontSize: 12 }}>{added! >= 0 ? `+${added}` : added}</Text>
          <Text tone="faint" variant="caption">=</Text>
          <Text style={{ fontFamily: fonts.dot, fontSize: 12 }}>{total}</Text>
          <Text tone="faint" style={{ fontSize: 10 }}>{unit}</Text>
        </>
      ) : <Text style={{ fontFamily: fonts.dot, fontSize: 12 }}>{weight}</Text>}
      <Text tone="faint" variant="caption">×</Text>
      <Text style={{ fontFamily: fonts.dot, fontSize: 12 }}>{reps}</Text>
      {toFailure ? <WorkoutGlyph name="flame" size={12} color={colors.flameText} /> : null}
    </View>
  );
}
