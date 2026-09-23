import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import type { Equipment } from "@deepgym/core/workout";
import {
  buildPlateSpecs,
  calcPlateVariants,
  calcPlatesGreedy,
  formatWeight,
  kgToUnit,
  nextDumbbellSteps,
  nextPlateSteps,
  roundWeight,
  type PlateCount,
  type Unit,
} from "@deepgym/core/weight";
import { useProfile } from "../data/queries";
import { useI18n } from "../providers/locale-provider";
import { colors, radii } from "../theme";
import { BottomSheet, DotValue, GradientCard, Text } from "../ui";

export interface WorkoutPlateContext {
  weightKg: number;
  equipment: Equipment;
  unit: Unit;
}

function PlateChip({ item }: { item: PlateCount }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ width: 15, height: 15, borderRadius: 8, borderWidth: Math.min(6, 2.5 + item.plate.kg / 9), borderColor: "rgba(215,246,81,0.8)" }} />
      <DotValue value={item.count * 2} size={13} />
      <Text variant="caption" tone="faint">×</Text>
      <Text variant="caption">{item.plate.value} {item.plate.unit}</Text>
    </View>
  );
}

/** The form's plate action mirrors the PWA's in-place PlateSheet. */
export function WorkoutPlateSheet({ context, onClose }: { context: WorkoutPlateContext | null; onClose: () => void }) {
  const { t } = useI18n();
  const profile = useProfile().data;
  const unit = context?.unit ?? profile?.unit ?? "kg";
  const weightKg = context?.weightKg ?? 0;
  const isDumbbell = context?.equipment === "dumbbell";
  const isBarbell = context?.equipment === "free_weight";
  const barKg = profile?.bar_weight_kg ?? 20;
  const specs = useMemo(() => buildPlateSpecs(profile?.plates_kg ?? [], profile?.plates_lb ?? []), [profile?.plates_kg, profile?.plates_lb]);
  const barCoversAll = isBarbell && weightKg <= barKg;
  const variants = useMemo(() => context && !isDumbbell && !barCoversAll && weightKg > 0 ? calcPlateVariants(weightKg, specs, isBarbell ? barKg : undefined) : [], [context, isDumbbell, barCoversAll, weightKg, specs, isBarbell, barKg]);
  const closest = useMemo(() => context && !isDumbbell && !barCoversAll && weightKg > 0 && !variants.length ? calcPlatesGreedy(weightKg, specs, isBarbell ? barKg : undefined) : null, [context, isDumbbell, barCoversAll, variants.length, weightKg, specs, isBarbell, barKg]);
  const plateSteps = useMemo(() => context && !isDumbbell && weightKg > 0 ? nextPlateSteps(Math.max(weightKg, isBarbell ? barKg : 0), specs) : [], [context, isDumbbell, weightKg, isBarbell, barKg, specs]);
  const dumbbellSteps = useMemo(() => context && isDumbbell && weightKg > 0 ? nextDumbbellSteps(weightKg, unit) : [], [context, isDumbbell, weightKg, unit]);
  const title = isDumbbell ? t("plates.dumbbells") : isBarbell ? t("plates.loadBar") : t("plates.loadPlates");
  const percentOver = (next: number) => `+${Math.round(((next - weightKg) / weightKg) * 1000) / 10}%`;

  return (
    <BottomSheet open={context != null} onClose={onClose} title={title} closeLabel={t("common.close")}>
      {context ? (
        <View style={{ gap: 17 }}>
          <GradientCard variant="indigo" radius={radii.tile} padding={19} style={{ minHeight: 108 }}>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <DotValue value={roundWeight(kgToUnit(weightKg, unit))} suffix={isDumbbell ? t("plates.each", { unit }) : unit} size={43} color={colors.white} suffixStyle={{ color: colors.white, opacity: 0.7 }} />
              {isBarbell && !barCoversAll ? <Text variant="caption" tone="muted" style={{ marginTop: 7, textAlign: "center", color: "rgba(255,255,255,0.6)" }}>{t("plates.includesBar", { bar: formatWeight(barKg, unit) })}</Text> : null}
            </View>
          </GradientCard>

          {plateSteps.length || dumbbellSteps.length ? (
            <View style={{ borderRadius: radii.tile, borderWidth: 1, borderColor: "rgba(215,246,81,0.3)", backgroundColor: "rgba(215,246,81,0.045)", padding: 12, gap: 9 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(215,246,81,0.16)" }}><Ionicons name="arrow-up" size={13} color={colors.lime} /></View>
                <Text weight="semibold" style={{ fontSize: 13 }}>{t("plates.nextStep")}</Text>
              </View>
              <Text tone="faint" style={{ fontSize: 11, lineHeight: 16 }}>{t(isDumbbell ? "plates.nextDumbbellHint" : "plates.nextHint")}</Text>
              {isDumbbell ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {dumbbellSteps.map((next, index) => (
                    <View key={next} style={{ flexDirection: "row", gap: 5, borderRadius: radii.pill, borderWidth: 1, borderColor: index === 0 ? "rgba(215,246,81,0.45)" : colors.line, backgroundColor: colors.raised, paddingHorizontal: 9, paddingVertical: 6 }}>
                      <DotValue value={roundWeight(kgToUnit(next, unit))} size={12} color={index === 0 ? colors.lime : colors.text} />
                      <Text variant="caption" tone="muted">{unit}</Text><Text variant="caption" tone="lime">{percentOver(next)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ gap: 9 }}>
                  {plateSteps[0] ? (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
                        <DotValue value="+" size={18} color={colors.lime} />
                        {plateSteps[0].add.map((item) => <PlateChip key={`${item.plate.unit}-${item.plate.value}`} item={item} />)}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <DotValue value={roundWeight(kgToUnit(plateSteps[0].targetKg, unit))} suffix={unit} size={18} />
                        <Text variant="caption" tone="lime">{percentOver(plateSteps[0].targetKg)}</Text>
                      </View>
                    </View>
                  ) : null}
                  {plateSteps.slice(1).length ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {plateSteps.slice(1).map((step) => (
                        <View key={step.deltaKg} style={{ flexDirection: "row", gap: 5, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised, paddingHorizontal: 9, paddingVertical: 6 }}>
                          <Text variant="caption" tone="faint">+{step.add.map((item) => `${item.count * 2}×${item.plate.value}`).join(" ")}</Text>
                          <DotValue value={roundWeight(kgToUnit(step.targetKg, unit))} size={12} />
                          <Text variant="caption" tone="muted">{unit}</Text><Text variant="caption" tone="lime">{percentOver(step.targetKg)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          {isDumbbell ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radii.tile, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 14 }}>
                <Text weight="medium" style={{ flex: 1 }}>{t("plates.dumbbell", { weight: formatWeight(weightKg, unit) })}</Text>
                <DotValue value="x2" size={20} color={colors.lime} />
              </View>
              <Text tone="muted" variant="caption" style={{ textAlign: "center" }}>{t("plates.oneEachHand")} · {roundWeight(kgToUnit(weightKg * 2, unit))} {t("plates.totalLoad", { unit })}</Text>
            </View>
          ) : barCoversAll ? (
            <Text tone="muted" variant="caption" style={{ textAlign: "center" }}>{t("plates.barCovers")}</Text>
          ) : variants.length ? (
            <View style={{ gap: 8 }}>
              <Text variant="micro" tone="muted">{t("plates.ways")}</Text>
              {variants.map((variant, index) => (
                <View key={index} style={{ borderRadius: radii.tile, borderWidth: 1, borderColor: index === 0 ? "rgba(215,246,81,0.4)" : colors.line, backgroundColor: index === 0 ? "rgba(215,246,81,0.05)" : colors.surface, padding: 13, gap: 6 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                    {variant.counts.map((item) => <PlateChip key={`${item.plate.unit}-${item.plate.value}`} item={item} />)}
                    {index === 0 ? <Text variant="caption" tone="lime" style={{ marginLeft: "auto" }}>{t("plates.fewest")}</Text> : null}
                  </View>
                  {isBarbell || Math.abs(variant.assembledKg - weightKg) > 0.05 ? (
                    <Text variant="caption" tone="faint">
                      {isBarbell ? `${t("plates.perSide")} ${variant.counts.map((item) => `${item.count} × ${item.plate.value} ${item.plate.unit}`).join(" + ")}` : ""}
                      {Math.abs(variant.assembledKg - weightKg) > 0.05 ? ` · ≈ ${formatWeight(variant.assembledKg, unit)} ${t("plates.total")}` : ""}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : closest?.counts.length ? (
            <View style={{ gap: 8 }}>
              <Text variant="micro" tone="muted">{t("plates.closest")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, borderRadius: radii.tile, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 12 }}>
                {closest.counts.map((item) => <PlateChip key={`${item.plate.unit}-${item.plate.value}`} item={item} />)}
              </View>
              <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>{t("plates.missing", { weight: formatWeight(closest.remainderKg, unit) })}</Text>
            </View>
          ) : (
            <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>{t("plates.none")}</Text>
          )}
          <Pressable onPress={() => { onClose(); router.push({ pathname: "/settings", params: { open: "plates" } }); }} accessibilityRole="button" style={{ alignSelf: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text weight="semibold" tone="lime" style={{ fontSize: 14 }}>{t("plates.editPlates")}</Text>
          </Pressable>
        </View>
      ) : null}
    </BottomSheet>
  );
}
