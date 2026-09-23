import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import {
  buildPlateSpecs,
  calcPlateVariants,
  calcPlatesGreedy,
  formatWeight,
  kgToUnit,
  nextDumbbellSteps,
  nextPlateSteps,
  parseWeight,
  roundWeight,
  unitToKg,
  type PlateCount,
  type Unit,
} from "@deepgym/core/weight";
import { useProfile } from "../data/queries";
import { useI18n } from "../providers/locale-provider";
import { colors, fonts, radii } from "../theme";
import { Card, DotValue, GradientCard, Screen, Segmented, Text } from "../ui";
import { ErrorState, Header, LoadingState } from "./common";

type LoadMode = "free_weight" | "machine" | "dumbbell";
const MODES: readonly LoadMode[] = ["free_weight", "machine", "dumbbell"];

function asMode(value: string | undefined): LoadMode {
  if (value === "crossover") return "machine";
  return MODES.find((mode) => mode === value) ?? "free_weight";
}

function percentOver(targetKg: number, currentKg: number): string {
  const percent = Math.round(((targetKg - currentKg) / currentKg) * 1000) / 10;
  return `+${percent}%`;
}

/** The count is across both sides, while the core result stores per-side count. */
function PlateChip({ item }: { item: PlateCount }) {
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6,
      minHeight: 31, borderRadius: radii.pill, paddingLeft: 8, paddingRight: 12,
      backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line,
    }}>
      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: Math.min(6, 2.5 + item.plate.kg / 9), borderColor: "rgba(215,246,81,0.8)" }} />
      <DotValue value={item.count * 2} size={14} />
      <Text variant="caption" tone="faint">×</Text>
      <Text style={{ fontSize: 14 }}>{item.plate.value} {item.plate.unit}</Text>
    </View>
  );
}

function EditPlatesButton() {
  const { t } = useI18n();
  return (
    <Pressable onPress={() => router.push({ pathname: "/settings", params: { open: "plates" } })}
      accessibilityRole="button" style={{ alignSelf: "center", paddingVertical: 12, paddingHorizontal: 16 }}>
      <Text weight="semibold" tone="lime" style={{ fontSize: 14 }}>{t("plates.editPlates")}</Text>
    </Pressable>
  );
}

export function PlateCalculatorScreen() {
  const { t } = useI18n();
  const profileQuery = useProfile();
  const params = useLocalSearchParams<{ weightKg?: string; equipment?: string; unit?: string }>();
  const profile = profileQuery.data;
  const [mode, setMode] = useState<LoadMode>(() => asMode(params.equipment));
  const [unitOverride, setUnitOverride] = useState<Unit | null>(() =>
    params.unit === "kg" || params.unit === "lb"
      ? params.unit
      : Number(params.weightKg) > 0 ? "kg" : null,
  );
  const unit = unitOverride ?? profile?.unit ?? "kg";
  const [weightText, setWeightText] = useState(() => {
    const initialKg = Number(params.weightKg);
    const initialUnit = params.unit === "kg" || params.unit === "lb" ? params.unit : "kg";
    return Number.isFinite(initialKg) && initialKg > 0
      ? String(roundWeight(kgToUnit(initialKg, initialUnit)))
      : "";
  });
  const inputWeight = parseWeight(weightText);
  const weightKg = inputWeight == null ? null : unitToKg(inputWeight, unit);
  const barKg = profile?.bar_weight_kg ?? 20;
  const isBarbell = mode === "free_weight";
  const isDumbbell = mode === "dumbbell";
  const barCoversAll = weightKg != null && isBarbell && weightKg <= barKg;
  const specs = useMemo(
    () => buildPlateSpecs(profile?.plates_kg ?? [], profile?.plates_lb ?? []),
    [profile?.plates_kg, profile?.plates_lb],
  );
  const variants = useMemo(
    () => weightKg != null && !isDumbbell && !barCoversAll
      ? calcPlateVariants(weightKg, specs, isBarbell ? barKg : undefined)
      : [],
    [weightKg, specs, isDumbbell, barCoversAll, isBarbell, barKg],
  );
  const closest = useMemo(
    () => weightKg != null && !isDumbbell && !barCoversAll && variants.length === 0
      ? calcPlatesGreedy(weightKg, specs, isBarbell ? barKg : undefined)
      : null,
    [weightKg, specs, isDumbbell, barCoversAll, variants.length, isBarbell, barKg],
  );
  const plateSteps = useMemo(
    () => weightKg != null && !isDumbbell
      ? nextPlateSteps(Math.max(weightKg, isBarbell ? barKg : 0), specs)
      : [],
    [weightKg, isDumbbell, isBarbell, barKg, specs],
  );
  const dumbbellSteps = useMemo(
    () => weightKg != null && isDumbbell ? nextDumbbellSteps(weightKg, unit) : [],
    [weightKg, isDumbbell, unit],
  );

  function changeUnit(next: Unit) {
    if (next === unit) return;
    if (inputWeight != null) {
      setWeightText(String(roundWeight(kgToUnit(unitToKg(inputWeight, unit), next))));
    }
    setUnitOverride(next);
  }

  if (profileQuery.isLoading && !profile) {
    return <Screen><Header title={t("settings.plateCalc")} back /><LoadingState /></Screen>;
  }
  if (!profile) {
    return <Screen><Header title={t("settings.plateCalc")} back /><ErrorState message={t("common.error")} retry={() => profileQuery.refetch()} /></Screen>;
  }

  const title = isDumbbell ? t("plates.dumbbells") : isBarbell ? t("plates.loadBar") : t("plates.loadPlates");

  return (
    <Screen bottomPadding={35}>
      <Header title={t("settings.plateCalc")} back />
      <Card style={{ marginTop: 14, marginBottom: 14 }}>
        <Text variant="micro" tone="muted">{t("settings.plateCalc")}</Text>
        <Segmented
          value={mode}
          onChange={setMode}
          options={MODES.map((value) => ({ value, label: t(`equipment.${value}`) }))}
          style={{ marginTop: 14 }}
        />
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="muted" style={{ marginBottom: 7 }}>{t("detail.weightUnit", { unit })}</Text>
            <TextInput
              value={weightText}
              onChangeText={(value) => setWeightText(value.replace(/[^\d.,]/g, ""))}
              keyboardType="decimal-pad"
              autoCorrect={false}
              selectTextOnFocus
              accessibilityLabel={t("detail.weightUnit", { unit })}
              placeholder={unit === "kg" ? "60" : "135"}
              placeholderTextColor={colors.faint}
              style={{
                minHeight: 52, backgroundColor: colors.raised, color: colors.text,
                borderWidth: 1, borderColor: colors.line, borderRadius: radii.medium,
                paddingHorizontal: 15, fontFamily: fonts.semibold, fontSize: 22,
              }}
            />
          </View>
          <Segmented
            value={unit}
            onChange={changeUnit}
            options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]}
            style={{ width: 112, padding: 2 }}
          />
        </View>
        <Text variant="caption" tone="faint" style={{ marginTop: 12 }}>{t("settings.plateCalcHint")}</Text>
      </Card>

      {weightKg != null ? <>
        <Text variant="micro" tone="muted" style={{ marginBottom: 9 }}>{title}</Text>
        <GradientCard variant="indigo" radius={radii.tile} padding={20} style={{ minHeight: 124, marginBottom: 20 }}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <DotValue value={roundWeight(kgToUnit(weightKg, unit))} suffix={isDumbbell ? t("plates.each", { unit }) : unit} size={48} color={colors.white} suffixStyle={{ color: colors.white, opacity: 0.7 }} />
            {isBarbell && !barCoversAll ? (
              <Text variant="caption" tone="muted" style={{ marginTop: 8, textAlign: "center", color: "rgba(255,255,255,0.6)" }}>{t("plates.includesBar", { bar: formatWeight(barKg, unit) })}</Text>
            ) : null}
          </View>
        </GradientCard>

        {plateSteps.length || dumbbellSteps.length ? (
          <View style={{ marginBottom: 20, borderRadius: radii.tile, borderWidth: 1, borderColor: "rgba(215,246,81,0.3)", backgroundColor: "rgba(215,246,81,0.045)", padding: 12, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(215,246,81,0.16)" }}><Ionicons name="arrow-up" size={13} color={colors.lime} /></View>
              <Text weight="semibold" style={{ fontSize: 13 }}>{t("plates.nextStep")}</Text>
            </View>
            <Text tone="faint" style={{ fontSize: 11, lineHeight: 16 }}>
              {t(isDumbbell ? "plates.nextDumbbellHint" : "plates.nextHint")}
            </Text>
            {isDumbbell ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {dumbbellSteps.map((targetKg, index) => (
                  <View key={targetKg} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: index === 0 ? "rgba(215,246,81,0.45)" : colors.line, backgroundColor: colors.raised, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <DotValue value={roundWeight(kgToUnit(targetKg, unit))} size={12} color={index === 0 ? colors.lime : colors.text} />
                    <Text variant="caption" tone="muted">{unit}</Text>
                    <Text variant="caption" tone="lime">{percentOver(targetKg, weightKg)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {plateSteps[0] ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      <DotValue value="+" size={18} color={colors.lime} />
                      {plateSteps[0].add.map((item) => <PlateChip key={`${item.plate.unit}-${item.plate.value}`} item={item} />)}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <DotValue value={roundWeight(kgToUnit(plateSteps[0].targetKg, unit))} suffix={unit} size={20} />
                      <Text variant="caption" tone="lime">{percentOver(plateSteps[0].targetKg, weightKg)}</Text>
                    </View>
                  </View>
                ) : null}
                {plateSteps.length > 1 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {plateSteps.slice(1).map((step) => (
                      <View key={step.deltaKg} style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text variant="caption" tone="faint">+{step.add.map((item) => `${item.count * 2}×${item.plate.value}`).join(" ")}</Text>
                        <DotValue value={roundWeight(kgToUnit(step.targetKg, unit))} size={12} />
                        <Text variant="caption" tone="muted">{unit}</Text>
                        <Text variant="caption" tone="lime">{percentOver(step.targetKg, weightKg)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {isDumbbell ? (
          <View style={{ marginBottom: 20, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radii.tile, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <Ionicons name="barbell-outline" size={24} color={colors.lime} />
                <Text weight="medium" numberOfLines={2}>{t("plates.dumbbell", { weight: formatWeight(weightKg, unit) })}</Text>
              </View>
              <DotValue value="x2" size={20} color={colors.lime} />
            </View>
            <Text tone="muted" style={{ fontSize: 14, lineHeight: 20, textAlign: "center" }}>
              {t("plates.oneEachHand")} · <Text style={{ fontFamily: fonts.dot }}>{roundWeight(kgToUnit(weightKg * 2, unit))}</Text> {t("plates.totalLoad", { unit })}
            </Text>
          </View>
        ) : barCoversAll ? (
          <Text tone="muted" style={{ marginBottom: 20, textAlign: "center", fontSize: 14 }}>{t("plates.barCovers")}</Text>
        ) : variants.length ? (
          <View style={{ marginBottom: 20, gap: 8 }}>
            <Text tone="muted" weight="medium" style={{ fontSize: 13, marginBottom: 2 }}>{t("plates.ways")}</Text>
            {variants.map((variant, index) => (
              <View key={index} style={{ borderRadius: radii.tile, borderWidth: 1, borderColor: index === 0 ? "rgba(215,246,81,0.4)" : colors.line, backgroundColor: index === 0 ? "rgba(215,246,81,0.05)" : colors.surface, paddingHorizontal: 16, paddingVertical: 12 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
                  {variant.counts.map((item) => <PlateChip key={`${item.plate.unit}-${item.plate.value}`} item={item} />)}
                  {index === 0 ? <View style={{ marginLeft: "auto", borderRadius: radii.pill, borderWidth: 1, borderColor: "rgba(215,246,81,0.28)", backgroundColor: "rgba(215,246,81,0.09)", paddingHorizontal: 10, paddingVertical: 5 }}><Text variant="caption" tone="lime">{t("plates.fewest")}</Text></View> : null}
                </View>
                {(isBarbell || Math.abs(variant.assembledKg - weightKg) > 0.05) ? (
                  <Text variant="caption" tone="faint" style={{ marginTop: 6 }}>
                    {isBarbell ? <>
                    {t("plates.perSide")} {variant.counts.map((item) => `${item.count} × ${item.plate.value} ${item.plate.unit}`).join(" + ")}
                    </> : null}
                    {Math.abs(variant.assembledKg - weightKg) > 0.05 ? `${isBarbell ? " · " : ""}≈ ${formatWeight(variant.assembledKg, unit)} ${t("plates.total")}` : null}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : closest?.counts.length ? (
          <View style={{ gap: 8, marginBottom: 20 }}>
            <Text tone="muted" weight="medium" style={{ fontSize: 13 }}>{t("plates.closest")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, borderRadius: radii.tile, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12 }}>
              {closest.counts.map((item) => <PlateChip key={`${item.plate.unit}-${item.plate.value}`} item={item} />)}
            </View>
            <Text tone="muted" style={{ fontSize: 14, lineHeight: 20, textAlign: "center" }}>
              {t("plates.missing", { weight: formatWeight(closest.remainderKg, unit) })}
            </Text>
          </View>
        ) : (
          <Text tone="muted" style={{ marginBottom: 20, textAlign: "center", fontSize: 14 }}>{t("plates.none")}</Text>
        )}
      </> : null}

      <EditPlatesButton />
    </Screen>
  );
}
