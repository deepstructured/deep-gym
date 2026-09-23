import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View } from "react-native";
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
import { Button, Card, DotValue, GradientCard, Screen, Segmented, Text } from "../ui";
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
      flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7,
      minHeight: 38, borderRadius: radii.pill, paddingHorizontal: 10,
      backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line,
    }}>
      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: Math.min(5, 2 + item.plate.kg / 10), borderColor: colors.lime }} />
      <Text weight="semibold">{item.count * 2}×</Text>
      <Text variant="caption" tone="muted">{item.plate.value} {item.plate.unit}</Text>
    </View>
  );
}

function EditPlatesButton() {
  const { t } = useI18n();
  return (
    <Button variant="surface" block onPress={() => router.push({ pathname: "/settings", params: { open: "plates" } })}>
      {t("plates.editPlates")}
    </Button>
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
              onChangeText={setWeightText}
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
        <GradientCard variant="indigo" style={{ minHeight: 138, marginBottom: 14 }}>
          <View style={{ flex: 1, justifyContent: "space-between" }}>
            <Text variant="micro" tone="white">{title}</Text>
            <DotValue value={roundWeight(kgToUnit(weightKg, unit))} suffix={isDumbbell ? t("plates.each", { unit }) : unit} size={46} />
            {isBarbell && !barCoversAll ? (
              <Text variant="caption" tone="muted">{t("plates.includesBar", { bar: formatWeight(barKg, unit) })}</Text>
            ) : null}
          </View>
        </GradientCard>

        {plateSteps.length || dumbbellSteps.length ? (
          <Card style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Ionicons name="trending-up" size={17} color={colors.lime} />
              <Text variant="title">{t("plates.nextStep")}</Text>
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: 5, marginBottom: 15 }}>
              {t(isDumbbell ? "plates.nextDumbbellHint" : "plates.nextHint")}
            </Text>
            {isDumbbell ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {dumbbellSteps.map((targetKg, index) => (
                  <View key={targetKg} style={{ backgroundColor: index === 0 ? "rgba(215,246,81,0.12)" : colors.raised, borderRadius: radii.medium, paddingHorizontal: 13, paddingVertical: 11 }}>
                    <Text weight="semibold" tone={index === 0 ? "lime" : "primary"}>{formatWeight(targetKg, unit)}</Text>
                    <Text variant="caption" tone="muted">{percentOver(targetKg, weightKg)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ gap: 13 }}>
                {plateSteps.map((step, index) => (
                  <View key={step.deltaKg} style={{
                    borderRadius: radii.medium, padding: 12, backgroundColor: index === 0 ? "rgba(215,246,81,0.08)" : colors.raised,
                    borderWidth: 1, borderColor: index === 0 ? "rgba(215,246,81,0.22)" : colors.line,
                  }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 9 }}>
                      <Text tone="lime" weight="bold">+</Text>
                      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                        {step.add.map((item) => <PlateChip key={`${item.plate.unit}-${item.plate.value}`} item={item} />)}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text weight="semibold">{formatWeight(step.targetKg, unit)}</Text>
                        <Text variant="caption" tone="muted">{percentOver(step.targetKg, weightKg)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        ) : null}

        {isDumbbell ? (
          <Card style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text weight="semibold">{t("plates.dumbbell", { weight: formatWeight(weightKg, unit) })}</Text>
              <DotValue value="×2" size={26} color={colors.lime} />
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: 10 }}>
              {t("plates.oneEachHand")} · {roundWeight(kgToUnit(weightKg * 2, unit))} {t("plates.totalLoad", { unit })}
            </Text>
          </Card>
        ) : barCoversAll ? (
          <Card style={{ marginBottom: 14 }}><Text tone="muted">{t("plates.barCovers")}</Text></Card>
        ) : variants.length ? (
          <View style={{ marginBottom: 14 }}>
            <Text variant="micro" tone="muted" style={{ marginBottom: 9, marginLeft: 3 }}>{t("plates.ways")}</Text>
            {variants.map((variant, index) => (
              <Card key={index} variant={index === 0 ? "live" : "surface"} padding={15} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
                  {variant.counts.map((item) => <PlateChip key={`${item.plate.unit}-${item.plate.value}`} item={item} />)}
                  {index === 0 ? <Text variant="caption" tone="lime">{t("plates.fewest")}</Text> : null}
                </View>
                {isBarbell ? (
                  <Text variant="caption" tone="muted" style={{ marginTop: 10 }}>
                    {t("plates.perSide")} {variant.counts.map((item) => `${item.count} × ${item.plate.value} ${item.plate.unit}`).join(" + ")}
                  </Text>
                ) : null}
                {Math.abs(variant.assembledKg - weightKg) > 0.05 ? (
                  <Text variant="caption" tone="muted" style={{ marginTop: 5 }}>≈ {formatWeight(variant.assembledKg, unit)} {t("plates.total")}</Text>
                ) : null}
              </Card>
            ))}
          </View>
        ) : closest?.counts.length ? (
          <Card style={{ marginBottom: 14 }}>
            <Text variant="micro" tone="muted" style={{ marginBottom: 12 }}>{t("plates.closest")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {closest.counts.map((item) => <PlateChip key={`${item.plate.unit}-${item.plate.value}`} item={item} />)}
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: 13 }}>
              {t("plates.missing", { weight: formatWeight(closest.remainderKg, unit) })}
            </Text>
          </Card>
        ) : (
          <Card style={{ marginBottom: 14 }}><Text tone="muted">{t("plates.none")}</Text></Card>
        )}
      </> : null}

      <EditPlatesButton />
    </Screen>
  );
}
