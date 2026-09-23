import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Workout } from "@deepgym/core/types";
import { kgToUnit, roundWeight, type Unit } from "@deepgym/core/weight";
import { workoutsForGroup } from "@deepgym/core/analytics";
import { translateCount, type MessageKey } from "@deepgym/core/i18n";
import { exerciseHistory, exerciseProgress, repsByWeight, type ProgressMetric } from "../data/exercise-detail";
import { useI18n } from "../providers/locale-provider";
import { colors } from "../theme";
import { BottomSheet, Card, DotValue, Text } from "../ui";
import { filterByLoad, loadOptions, progressSummary, type LoadFilter } from "./progress-analytics";
import { ProgressTrendLine } from "./progress-trend-line";
export { ProgressTrendLine } from "./progress-trend-line";
import { lookbackStart, type LookbackPeriod } from "./period-range";
import { usePreferredPeriod } from "./use-preferred-period";

interface ExerciseOption {
  id: string;
  name: string;
  groupId: string | null;
  unit: Unit | null;
  bodyweight: boolean;
  lastDate: string;
}

const LOAD_PREFERENCE_KEY = "deepgym-chart-load";
const METRIC_TITLES: Record<ProgressMetric, MessageKey> = {
  topSet: "stats.weight",
  oneRm: "stats.oneRmLong",
  volume: "stats.volume",
  reps: "stats.reps",
  addedLoad: "stats.addedLoad",
};

/** Chart periods use the PWA's neutral selection, not the lime mode switch. */
export function ChartPeriodSwitch({ value, onChange, style }: {
  value: LookbackPeriod;
  onChange: (period: LookbackPeriod) => void;
  style?: React.ComponentProps<typeof View>["style"];
}) {
  const { t } = useI18n();
  const periods = ["1m", "3m", "6m", "1y", "all"] as const;
  const selected = useRef(new Animated.Value(periods.indexOf(value))).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    Animated.spring(selected, {
      toValue: periods.indexOf(value),
      stiffness: 280,
      damping: 26,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [selected, value]);
  const slotWidth = Math.max(0, (width - 6) / periods.length);
  return <View accessibilityRole="radiogroup" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[{ flexDirection: "row", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", backgroundColor: "rgba(255,255,255,0.03)", padding: 3, overflow: "hidden" }, style]}>
    {width > 0 ? <Animated.View pointerEvents="none" style={{ position: "absolute", top: 3, bottom: 3, left: 3, width: slotWidth, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.12)", transform: [{ translateX: Animated.multiply(selected, slotWidth) }] }} /> : null}
    {periods.map((period) => <Pressable key={period} onPress={() => onChange(period)} accessibilityRole="radio" accessibilityState={{ checked: period === value }} style={{ flex: 1, height: 30, borderRadius: 17, alignItems: "center", justifyContent: "center" }}>
      <Text weight="semibold" style={{ fontSize: 12, color: period === value ? colors.white : colors.muted }}>{t(`period.${period}`)}</Text>
    </Pressable>)}
  </View>;
}

export function MetricInfoSheet({ open, onClose, metrics, active }: {
  open: boolean;
  onClose: () => void;
  metrics: ProgressMetric[];
  active: ProgressMetric;
}) {
  const { t } = useI18n();
  return <BottomSheet open={open} onClose={onClose} title={t("stats.info.title")} closeLabel={t("common.close")}>
    <MetricInfoContent metrics={metrics} active={active} />
  </BottomSheet>;
}

export function MetricInfoContent({ metrics, active }: { metrics: ProgressMetric[]; active: ProgressMetric }) {
  const { t } = useI18n();
  const tips: { icon: React.ComponentProps<typeof Ionicons>["name"]; key: MessageKey }[] = [
    { icon: "stats-chart-outline", key: "stats.info.chart" },
    { icon: "filter-outline", key: "stats.info.filters" },
    { icon: "trophy-outline", key: "stats.info.records" },
    { icon: "flame-outline", key: "stats.info.warmup" },
  ];
  return <View style={{ gap: 10, paddingBottom: 12 }}>
      {metrics.map((item) => <View key={item} style={{ borderRadius: 16, borderWidth: 1, borderColor: item === active ? "rgba(215,246,81,0.45)" : colors.line, backgroundColor: item === active ? "rgba(215,246,81,0.05)" : colors.raised, paddingHorizontal: 14, paddingVertical: 12 }}>
        <Text weight="semibold">{t(METRIC_TITLES[item])}</Text>
        <Text tone="muted" style={{ fontSize: 13, lineHeight: 19, marginTop: 4 }}>{t(`stats.info.${item}`)}</Text>
        {item === "oneRm" ? <View style={{ borderRadius: 12, backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 }}><Text style={{ fontSize: 12, lineHeight: 18 }}>{t("stats.info.oneRmExample")}</Text></View> : null}
      </View>)}
      <View style={{ borderTopWidth: 1, borderTopColor: "rgba(42,42,49,0.7)", paddingTop: 14, gap: 10, marginTop: 4 }}>
        {tips.map((tip) => <View key={tip.key} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <Ionicons name={tip.icon} size={16} color={colors.lime} style={{ marginTop: 2 }} />
          <Text tone="muted" style={{ flex: 1, fontSize: 13, lineHeight: 19 }}>{t(tip.key)}</Text>
        </View>)}
      </View>
    </View>;
}

function MiniStat({ label, value, suffix, width = "32%" }: { label: string; value: string | number; suffix?: string; width?: `${number}%` }) {
  return <View style={{ width, minWidth: 0, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.035)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.045)", paddingHorizontal: 10, paddingVertical: 8 }}>
    <Text variant="micro" tone="muted" numberOfLines={1} style={{ fontSize: 9.5, lineHeight: 13, marginBottom: 2 }}>{label}</Text>
    <DotValue value={value} suffix={suffix} size={17} />
  </View>;
}

function RepsBreakdown({ records, bodyweight, unit }: { records: ReturnType<typeof exerciseHistory>; bodyweight: boolean; unit: Unit }) {
  const { t } = useI18n();
  const rows = repsByWeight(records, bodyweight).slice(0, 6);
  if (!rows.length) return null;
  const columns = [
    bodyweight ? t("stats.addedLoad") : t("detail.weight"),
    t("detail.sets"), t("detail.avg"), t("detail.med"), t("detail.mode"),
  ];
  const flexes = [1.2, 0.7, 0.7, 0.7, 0.7];
  return <View style={{ marginTop: 20 }}>
    <Text weight="medium" tone="muted" style={{ fontSize: 13, marginBottom: 8 }}>
      {t(bodyweight ? "detail.repsByAddedLoad" : "detail.repsByWeight")}
    </Text>
    <View style={{ flexDirection: "row", paddingHorizontal: 4, marginBottom: 4 }}>
      {columns.map((column, index) => <Text key={index} variant="micro" tone="muted" style={{ flex: flexes[index], fontSize: 9.5, lineHeight: 13, textAlign: index ? "center" : "left" }} numberOfLines={1}>{column}</Text>)}
    </View>
    {rows.map((row, index) => {
      const load = roundWeight(kgToUnit(row.weightKg, unit));
      return <View key={row.weightKg} style={{ flexDirection: "row", alignItems: "center", minHeight: 43, paddingHorizontal: 4, borderTopWidth: index ? 1 : 0, borderTopColor: "rgba(42,42,49,0.5)" }}>
        <View style={{ flex: flexes[0], flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 }}>
          <DotValue value={bodyweight && load > 0 ? `+${load}` : load} size={17} />
          {row.failureRate > 0 ? <Ionicons name="flame-outline" size={13} color={colors.flame} style={{ opacity: 0.4 + row.failureRate * 0.6 }} /> : null}
        </View>
        {[row.setCount, row.avgReps, row.medianReps, row.modeReps].map((value, cell) => (
          <View key={cell} style={{ flex: flexes[cell + 1], alignItems: "center" }}><DotValue value={value} size={14} color={cell === 0 ? colors.muted : colors.text} /></View>
        ))}
      </View>;
    })}
  </View>;
}

function ExerciseInsights({ chosen, workouts, since, profileUnit, loadMode, setLoadMode, period, onPeriodChange, detailMode = false, groupName }: {
  chosen: ExerciseOption;
  workouts: Workout[];
  since: string | null;
  profileUnit: Unit;
  loadMode: "working" | "all";
  setLoadMode: (mode: "working" | "all") => void;
  period: LookbackPeriod;
  onPeriodChange: (period: LookbackPeriod) => void;
  detailMode?: boolean;
  groupName?: string;
}) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [metric, setMetric] = useState<ProgressMetric>(chosen.bodyweight ? "reps" : "topSet");
  const [specificLoad, setSpecificLoad] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fullscreenInfoOpen, setFullscreenInfoOpen] = useState(false);
  useEffect(() => { if (!expanded) setFullscreenInfoOpen(false); }, [expanded]);
  const [showTrend, setShowTrend] = useState(true);
  const [showAverage, setShowAverage] = useState(false);
  const [showRecords, setShowRecords] = useState(true);
  const [showSmoothing, setShowSmoothing] = useState(false);
  useEffect(() => setActiveIndex(null), [since]);
  const unit = chosen.unit ?? profileUnit;
  const records = useMemo(() => exerciseHistory(workouts, chosen.id), [workouts, chosen.id]);
  const options = useMemo(() => loadOptions(records), [records]);
  const filter: LoadFilter = chosen.bodyweight ? { mode: "all" } : specificLoad != null ? { mode: "weight", weightKg: specificLoad } : { mode: loadMode };
  const filteredRecords = useMemo(() => filterByLoad(records, filter), [records, filter.mode, specificLoad, loadMode]);
  const allFilteredPoints = useMemo(() => exerciseProgress(filteredRecords, metric), [filteredRecords, metric]);
  const periodRecords = useMemo(() => filteredRecords.filter((record) => !since || record.workoutDate >= since), [filteredRecords, since]);
  const points = useMemo(() => allFilteredPoints.filter((point) => !since || point.date >= since), [allFilteredPoints, since]);
  const markers = useMemo(() => {
    const dates = new Set<string>();
    let previousBest = -Infinity;
    allFilteredPoints.forEach((point, index) => {
      if (index > 0 && point.value > previousBest + 1e-9) dates.add(point.date);
      previousBest = Math.max(previousBest, point.value);
    });
    return new Set(points.flatMap((point, index) => dates.has(point.date) ? [index] : []));
  }, [allFilteredPoints, points]);
  useEffect(() => {
    if (activeIndex != null && activeIndex >= points.length) setActiveIndex(null);
  }, [activeIndex, points.length]);
  const summary = useMemo(() => progressSummary(periodRecords, chosen.bodyweight), [periodRecords, chosen.bodyweight]);
  const first = points[0];
  const latest = points.at(-1);
  const shown = activeIndex != null ? points[activeIndex] ?? latest : latest;
  const showLoad = metric !== "reps";
  const chartValues = points.map((point) => showLoad ? kgToUnit(point.value, unit) : point.value);
  const available: ProgressMetric[] = chosen.bodyweight ? ["reps", "addedLoad"] : ["topSet", "oneRm", "volume", "reps"];
  const filterCaption = filter.mode === "working"
    ? t("stats.filter.workingHint")
    : filter.mode === "weight"
      ? t("stats.filter.weightHint", { weight: `${roundWeight(kgToUnit(filter.weightKg, unit))} ${unit}` })
      : t("stats.filter.allHint");
  const signed = (value: number) => value > 0 ? `+${value}` : String(value);
  const metricValue = (value: number) => {
    const display = showLoad ? kgToUnit(value, unit) : value;
    if (metric === "volume") return String(Math.round(display)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const rounded = metric === "reps" ? Math.round(display) : roundWeight(display);
    return metric === "addedLoad" ? signed(rounded) : String(rounded);
  };
  const metricDelta = (value: number) => {
    const display = showLoad ? kgToUnit(value, unit) : value;
    const rounded = metric === "volume" || metric === "reps" ? Math.round(display) : roundWeight(display);
    const magnitude = metric === "volume"
      ? String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
      : String(Math.abs(rounded));
    return rounded > 0 ? `+${magnitude}` : rounded < 0 ? `−${magnitude}` : "0";
  };
  const pointDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(lang, { weekday: "short", month: "short", day: "numeric" });
  const volume = summary.totalVolumeKg == null ? null : Math.round(kgToUnit(summary.totalVolumeKg, unit)).toLocaleString(lang);
  const stats = [
    chosen.bodyweight
      ? { label: t("detail.bestAddedLoad"), value: summary.bestAddedLoadKg == null ? "—" : signed(roundWeight(kgToUnit(summary.bestAddedLoadKg, unit))), suffix: summary.bestAddedLoadKg == null ? undefined : unit }
      : { label: t("detail.est1rm"), value: summary.estOneRepMaxKg == null ? "—" : roundWeight(kgToUnit(summary.estOneRepMaxKg, unit)), suffix: summary.estOneRepMaxKg == null ? undefined : unit },
    { label: t("detail.totalSets"), value: summary.totalSets },
    { label: t("stats.totalReps"), value: summary.totalReps },
    volume == null
      ? { label: t("detail.sessions"), value: summary.sessions }
      : { label: t("stats.volume"), value: volume, suffix: unit },
    { label: t("stats.failRate"), value: `${Math.round(summary.failureRate * 100)}%` },
    { label: t("stats.perWeekShort"), value: summary.perWeek ?? "—", suffix: summary.perWeek == null ? undefined : "×" },
  ];
  const seriesSummary = (() => {
    if (!points.length) return null;
    const values = points.map((point) => point.value);
    const best = Math.max(...values);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const times = points.map((point) => Date.parse(`${point.date}T12:00:00`) / 86_400_000);
    const meanTime = times.reduce((sum, value) => sum + value, 0) / times.length;
    const meanValue = average;
    const slopeNumerator = times.reduce((sum, time, index) => sum + (time - meanTime) * (values[index] - meanValue), 0);
    const slopeDenominator = times.reduce((sum, time) => sum + (time - meanTime) ** 2, 0);
    const trend = slopeDenominator > 0 ? slopeNumerator / slopeDenominator * 30 : null;
    return [
      { label: t("stats.best"), value: metricValue(best), suffix: showLoad ? unit : undefined },
      { label: t("stats.average"), value: metricValue(average), suffix: showLoad ? unit : undefined },
      { label: t("stats.trend"), value: trend == null ? "—" : metricDelta(trend), suffix: trend == null ? undefined : `${showLoad ? unit : ""}${t("stats.perMonthUnit")}` },
      { label: t("detail.sessions"), value: points.length },
    ];
  })();
  const changePct = first && latest && first.value !== 0
    ? Math.round((latest.value - first.value) / Math.abs(first.value) * 100)
    : 0;
  const shownPct = first && shown && first.value !== 0
    ? Math.round((shown.value - first.value) / Math.abs(first.value) * 100)
    : 0;
  const fullscreenSummary = seriesSummary ? [
    ...seriesSummary.slice(0, 3),
    { label: t("detail.sessions"), value: points.length },
    { label: t("stats.records"), value: markers.size },
    { label: t("stats.change"), value: `${changePct > 0 ? "+" : ""}${changePct}%` },
  ] : null;
  function chooseMetric(next: ProgressMetric) {
    setMetric(next);
    setActiveIndex(null);
  }
  function chooseFilter(next: LoadFilter) {
    setActiveIndex(null);
    if (next.mode === "weight") {
      setSpecificLoad(next.weightKg);
      if (metric === "topSet") setMetric("reps");
    } else {
      setSpecificLoad(null);
      setLoadMode(next.mode);
    }
  }
  function renderLoadFilters() {
    if (chosen.bodyweight) return null;
    const chips = [
      { key: "working", label: t("stats.filter.working"), filter: { mode: "working" } as LoadFilter },
      { key: "all", label: t("stats.filter.all"), filter: { mode: "all" } as LoadFilter },
      ...options.map((weightKg) => ({
        key: String(weightKg),
        label: `${roundWeight(kgToUnit(weightKg, unit))} ${unit}`,
        filter: { mode: "weight", weightKg } as LoadFilter,
      })),
    ];
    return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingBottom: 9 }}>
      {chips.map((chip, index) => {
        const active = chip.filter.mode === "weight"
          ? specificLoad === chip.filter.weightKg
          : specificLoad == null && loadMode === chip.filter.mode;
        return <Pressable key={chip.key} onPress={() => chooseFilter(chip.filter)} accessibilityRole="button" accessibilityState={{ selected: active }} style={{ minHeight: 27, borderRadius: 14, borderWidth: 1, borderStyle: active ? "solid" : "dashed", borderColor: active ? "rgba(215,246,81,0.45)" : "rgba(255,255,255,0.12)", backgroundColor: active ? "rgba(215,246,81,0.1)" : "transparent", paddingHorizontal: 10, marginLeft: index === 2 ? 6 : 0, justifyContent: "center" }}>
          <Text weight="medium" style={{ fontSize: 11, lineHeight: 15, color: active ? colors.lime : colors.faint }}>{chip.label}</Text>
        </Pressable>;
      })}
    </ScrollView>;
  }
  const readout = shown ? <View style={{ minHeight: 59, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, paddingHorizontal: 2 }}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <DotValue value={metricValue(shown.value)} suffix={showLoad ? unit : undefined} size={35} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
        <Text variant="caption" tone="muted" style={{ fontSize: 11 }}>
          {activeIndex == null ? `${t("stats.latest")} · ` : ""}{pointDate(shown.date)}
          {activeIndex != null ? ` · ${translateCount(lang, "count.sets", shown.sets)}` : ""}
        </Text>
        {activeIndex != null && markers.has(activeIndex) ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(215,246,81,0.14)", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}><Ionicons name="trophy-outline" size={10} color={colors.lime} /><Text style={{ fontSize: 9, color: colors.lime }}>{t("stats.pr")}</Text></View> : null}
      </View>
    </View>
    {first && points.length > 1 && (activeIndex == null || activeIndex > 0) ? <View style={{ alignItems: "flex-end", maxWidth: "44%", paddingBottom: 2 }}>
      <DotValue value={metricDelta(shown.value - first.value)} suffix={showLoad ? unit : undefined} size={17} color={shown.value >= first.value ? colors.lime : colors.flame} />
      <Text variant="micro" tone="faint" numberOfLines={1} style={{ fontSize: 9.5, marginTop: 3 }}>
        {first.value !== 0 ? `${shownPct > 0 ? "+" : ""}${shownPct}% · ` : ""}{activeIndex != null ? t("stats.vsStart") : t(`period.over.${period}`)}
      </Text>
    </View> : null}
  </View> : <Text tone="muted" style={{ paddingVertical: 28, textAlign: "center" }}>{t("stats.emptyPeriod")}</Text>;

  return <>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 9 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 4 }}>
        {available.map((option) => <Pressable key={option} onPress={() => chooseMetric(option)} accessibilityRole="button" accessibilityState={{ selected: metric === option }} style={{ height: 28, borderRadius: 14, borderWidth: 1, borderColor: metric === option ? colors.white : "rgba(255,255,255,0.05)", backgroundColor: metric === option ? colors.white : "rgba(255,255,255,0.035)", paddingHorizontal: 12, justifyContent: "center" }}>
          <Text weight="medium" style={{ fontSize: 12, lineHeight: 16, color: metric === option ? colors.black : colors.muted }}>{t(`stats.metric.${option}`)}</Text>
        </Pressable>)}
      </ScrollView>
      <Pressable onPress={() => setInfoOpen(true)} accessibilityRole="button" accessibilityLabel={t("stats.info.title")} style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.raised }}>
        <Ionicons name="information-circle-outline" size={17} color={colors.muted} />
      </Pressable>
      <Pressable onPress={() => setExpanded(true)} accessibilityRole="button" accessibilityLabel={t("stats.fullscreen")} style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.raised }}>
        <Ionicons name="expand-outline" size={16} color={colors.muted} />
      </Pressable>
    </View>
    {renderLoadFilters()}
    <Text variant="caption" tone="faint" style={{ marginBottom: 12 }}>
      {t(`stats.caption.${metric}`)}{chosen.bodyweight ? "" : ` · ${filterCaption}`}
    </Text>
    {readout}
    {points.length ? <View style={{ marginTop: 12 }}><ProgressTrendLine values={chartValues} dates={points.map((point) => point.date)} locale={lang} chartId={`exerciseTrend-${chosen.id}`} color={colors.white} framed height={176} markers={markers} activeIndex={activeIndex} onActiveChange={setActiveIndex} /></View> : null}
    {detailMode ? <ChartPeriodSwitch value={period} onChange={(next) => { setActiveIndex(null); onPeriodChange(next); }} style={{ marginTop: 14 }} /> : null}
    {seriesSummary ? <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 5, marginTop: 14 }}>
      {seriesSummary.map((stat) => <MiniStat key={stat.label} {...stat} width="23%" />)}
    </View> : null}
    {!detailMode ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
      {stats.map((stat) => <MiniStat key={stat.label} {...stat} />)}
    </View> : null}
    {!detailMode ? <RepsBreakdown records={periodRecords} bodyweight={chosen.bodyweight} unit={unit} /> : null}
    {!detailMode ? <Pressable onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: chosen.id } })} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: "rgba(42,42,49,0.7)", marginTop: 18, paddingTop: 14, gap: 5 }}>
      <Text variant="caption" tone="muted" weight="medium">{t("progress.openExercise", { name: chosen.name })}</Text>
      <Ionicons name="chevron-forward" size={15} color={colors.muted} />
    </Pressable> : null}
    <MetricInfoSheet open={infoOpen && !expanded} onClose={() => setInfoOpen(false)} metrics={available} active={metric} />
    <Modal visible={expanded} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => fullscreenInfoOpen ? setFullscreenInfoOpen(false) : setExpanded(false)}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight="semibold" numberOfLines={1} style={{ fontSize: 20 }}>{chosen.name}</Text>
            <Text tone="muted" style={{ fontSize: 13, marginTop: 2 }}>{groupName || t("progress.exercises")}</Text>
          </View>
          <Pressable onPress={() => setFullscreenInfoOpen(true)} accessibilityRole="button" accessibilityLabel={t("stats.info.title")} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}><Ionicons name="information-circle-outline" size={20} color={colors.muted} /></Pressable>
          <Pressable onPress={() => { setFullscreenInfoOpen(false); setExpanded(false); }} accessibilityRole="button" accessibilityLabel={t("common.close")} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}><Ionicons name="close" size={23} color={colors.muted} /></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 24) + 24 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
            {available.map((option) => <Pressable key={option} onPress={() => chooseMetric(option)} accessibilityRole="button" accessibilityState={{ selected: metric === option }} style={{ minHeight: 32, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: metric === option ? colors.white : "rgba(255,255,255,0.05)", backgroundColor: metric === option ? colors.white : "rgba(255,255,255,0.035)" }}>
              <Text weight="medium" style={{ fontSize: 12, color: metric === option ? colors.black : colors.muted }}>{t(`stats.metric.${option}`)}</Text>
            </Pressable>)}
          </ScrollView>
          {renderLoadFilters()}
          <Text variant="caption" tone="faint" style={{ fontSize: 12, lineHeight: 17, marginTop: 2, marginBottom: 16 }}>{t(`stats.caption.${metric}`)}{chosen.bodyweight ? "" : ` · ${filterCaption}`}</Text>
          {readout}
          {points.length ? <View style={{ marginTop: 18 }}><ProgressTrendLine values={chartValues} dates={points.map((point) => point.date)} locale={lang} chartId={`expandedTrend-${chosen.id}`} color={colors.white} framed height={Math.round(Math.min(Math.max(windowHeight * 0.42, 220), 420))} markers={markers} showTrend={showTrend} showAverage={showAverage} showRecords={showRecords} showSmoothing={showSmoothing} activeIndex={activeIndex} onActiveChange={setActiveIndex} /></View> : null}
          <ChartPeriodSwitch value={period} onChange={(next) => { setActiveIndex(null); onPeriodChange(next); }} style={{ marginTop: 14, marginBottom: 14 }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {([
              { label: t("stats.tool.trend"), on: showTrend, toggle: () => setShowTrend((value) => !value), color: "#8c9bff", ring: false, solid: false },
              { label: t("stats.tool.average"), on: showAverage, toggle: () => setShowAverage((value) => !value), color: colors.lime, ring: false, solid: false },
              { label: t("stats.tool.records"), on: showRecords, toggle: () => setShowRecords((value) => !value), color: colors.lime, ring: true, solid: false },
              { label: t("stats.tool.smoothing"), on: showSmoothing, toggle: () => setShowSmoothing((value) => !value), color: "#f567b5", ring: false, solid: true },
            ]).map((tool) => <Pressable key={tool.label} onPress={tool.toggle} accessibilityRole="button" accessibilityState={{ selected: tool.on }} style={{ height: 32, borderRadius: 16, borderWidth: 1, borderColor: tool.on ? "rgba(255,255,255,0.14)" : colors.line, backgroundColor: tool.on ? colors.raised : "transparent", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7 }}>
              <View style={tool.ring ? { width: 10, height: 10, borderRadius: 5, borderWidth: 1.8, borderColor: tool.color } : { width: 14, borderTopWidth: 2, borderTopColor: tool.color, borderStyle: tool.solid ? "solid" : "dashed" }} />
              <Text style={{ fontSize: 12, color: tool.on ? colors.text : colors.faint }}>{tool.label}</Text>
            </Pressable>)}
          </View>
          {fullscreenSummary ? <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6, marginTop: 18 }}>
            {fullscreenSummary.map((stat) => <MiniStat key={stat.label} {...stat} width="32%" />)}
          </View> : null}
          {points.length ? <View style={{ marginTop: 20 }}>
            <Text weight="semibold" style={{ fontSize: 15, marginBottom: 10 }}>{t("stats.sessionsList")}</Text>
            <View style={{ borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
              {points.map((point, index) => ({ point, index })).reverse().map(({ point, index }, rowIndex) => {
                const prior = index > 0 ? points[index - 1] : null;
                const diff = prior ? point.value - prior.value : null;
                const sets = periodRecords.filter((record) => record.workoutDate === point.date && record.set_type !== "warmup");
                const bestSet = sets.reduce<(typeof sets)[number] | null>((best, record) => !best || (record.weight_kg ?? -Infinity) > (best.weight_kg ?? -Infinity) ? record : best, null);
                const setCaption = `${translateCount(lang, "count.sets", point.sets)}${metric !== "reps" && bestSet?.weight_kg != null && bestSet.reps != null ? ` · ${roundWeight(kgToUnit(bestSet.weight_kg, unit))} × ${bestSet.reps}` : ""}`;
                return <Pressable key={point.date} onPress={() => setActiveIndex(activeIndex === index ? null : index)} accessibilityRole="button" accessibilityState={{ selected: activeIndex === index }} style={{ minHeight: 66, borderTopWidth: rowIndex ? 1 : 0, borderTopColor: colors.line, backgroundColor: activeIndex === index ? "rgba(215,246,81,0.08)" : "transparent", paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" style={{ fontSize: 13 }}>{pointDate(point.date)}</Text><Text variant="caption" tone="muted" numberOfLines={1} style={{ fontSize: 11, marginTop: 3 }}>{setCaption}</Text></View>
                  {markers.has(index) ? <View style={{ flexDirection: "row", gap: 2, alignItems: "center", paddingHorizontal: 5, paddingVertical: 3, borderRadius: 9, backgroundColor: "rgba(215,246,81,0.13)" }}><Ionicons name="trophy-outline" size={10} color={colors.lime} /><Text style={{ color: colors.lime, fontSize: 9 }}>{t("stats.pr")}</Text></View> : null}
                  <View style={{ alignItems: "flex-end" }}><DotValue value={metricValue(point.value)} suffix={showLoad ? unit : undefined} size={18} />{diff != null && Math.abs(diff) > 1e-9 ? <Text style={{ color: diff > 0 ? colors.lime : colors.flame, fontSize: 10 }}>{metricDelta(diff)}</Text> : null}</View>
                </Pressable>;
              })}
            </View>
          </View> : null}
        </ScrollView>
        {fullscreenInfoOpen ? <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "flex-end", zIndex: 10 }}>
          <Pressable onPress={() => setFullscreenInfoOpen(false)} accessibilityRole="button" accessibilityLabel={t("common.close")} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.7)" }} />
          <View style={{ maxHeight: windowHeight * 0.88, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 20) }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: 15 }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <Text variant="title" style={{ flex: 1 }}>{t("stats.info.title")}</Text>
              <Pressable onPress={() => setFullscreenInfoOpen(false)} accessibilityRole="button" accessibilityLabel={t("common.close")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={23} color={colors.muted} /></Pressable>
            </View>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}><MetricInfoContent metrics={available} active={metric} /></ScrollView>
          </View>
        </View> : null}
      </View>
    </Modal>
  </>;
}

/** The exercise page uses the same chart, load filters, and fullscreen as Progress. */
export function ExerciseProgressForDetail({ exercise, workouts, profileUnit, groupName }: {
  exercise: { id: string; name: string; muscle_group_id: string; unit: Unit | null; equipment: string };
  workouts: Workout[];
  profileUnit: Unit;
  groupName?: string;
}) {
  const [period, setPeriod] = usePreferredPeriod();
  const [loadMode, setLoadMode] = useState<"working" | "all">("working");
  useFocusEffect(useCallback(() => {
    let active = true;
    void AsyncStorage.getItem(LOAD_PREFERENCE_KEY).then((stored) => {
      if (active && (stored === "working" || stored === "all")) setLoadMode(stored);
    }).catch(() => {});
    return () => { active = false; };
  }, []));
  const chosen: ExerciseOption = {
    id: exercise.id,
    name: exercise.name,
    groupId: exercise.muscle_group_id,
    unit: exercise.unit,
    bodyweight: exercise.equipment === "bodyweight",
    lastDate: "",
  };
  return <ExerciseInsights
    chosen={chosen}
    workouts={workouts}
    since={lookbackStart(period)}
    profileUnit={profileUnit}
    loadMode={loadMode}
    setLoadMode={(next) => { setLoadMode(next); void AsyncStorage.setItem(LOAD_PREFERENCE_KEY, next).catch(() => {}); }}
    period={period}
    onPeriodChange={setPeriod}
    detailMode
    groupName={groupName}
  />;
}

export function ProgressExerciseExplorer({ workouts, since, focus, unit, groups, period, onPeriodChange }: {
  workouts: Workout[];
  since: string | null;
  focus: string | null;
  unit: Unit;
  groups: { id: string; name: string }[];
  period: LookbackPeriod;
  onPeriodChange: (period: LookbackPeriod) => void;
}) {
  const { t } = useI18n();
  const [groupChoice, setGroupChoice] = useState<string | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [loadMode, setLoadMode] = useState<"working" | "all">("working");
  useFocusEffect(useCallback(() => {
    let active = true;
    void AsyncStorage.getItem(LOAD_PREFERENCE_KEY).then((stored) => {
      if (active && (stored === "working" || stored === "all")) setLoadMode(stored);
    }).catch(() => {});
    return () => { active = false; };
  }, []));
  function chooseLoadMode(next: "working" | "all") {
    setLoadMode(next);
    void AsyncStorage.setItem(LOAD_PREFERENCE_KEY, next).catch(() => {});
  }
  const exerciseOptions = useMemo(() => {
    const map = new Map<string, ExerciseOption>();
    for (const workout of workoutsForGroup(workouts, focus)) {
      for (const occurrence of workout.workout_exercises) {
        if (!occurrence.exercise || !occurrence.sets.some((set) => set.set_type !== "warmup" && (set.weight_kg != null || set.reps != null))) continue;
        const old = map.get(occurrence.exercise_id);
        map.set(occurrence.exercise_id, {
          id: occurrence.exercise_id,
          name: occurrence.exercise.name,
          groupId: occurrence.exercise.muscle_group_id,
          unit: occurrence.exercise.unit ?? null,
          bodyweight: occurrence.exercise.equipment === "bodyweight",
          lastDate: old?.lastDate && old.lastDate > workout.date ? old.lastDate : workout.date,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name));
  }, [workouts, focus]);
  const groupIdsWithData = new Set(exerciseOptions.map((exercise) => exercise.groupId));
  const groupsWithData = groups.filter((group) => groupIdsWithData.has(group.id));
  const activeGroupId = focus && groupIdsWithData.has(focus)
    ? focus
    : groupChoice && groupIdsWithData.has(groupChoice)
      ? groupChoice
      : exerciseOptions[0]?.groupId ?? null;
  const groupExercises = exerciseOptions.filter((exercise) => exercise.groupId === activeGroupId);
  const chosen = groupExercises.find((exercise) => exercise.id === chosenId) ?? groupExercises[0];
  return <>
    <Card variant="explorer" radius={24} padding={16}>
      {chosen ? <>
        {!focus && groupsWithData.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginBottom: 10 }} contentContainerStyle={{ gap: 7, paddingHorizontal: 16 }}>
          {groupsWithData.map((group) => <Pressable key={group.id} onPress={() => { setGroupChoice(group.id); setChosenId(null); }} accessibilityRole="button" accessibilityState={{ selected: group.id === activeGroupId }} style={{ minHeight: 32, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center", borderWidth: group.id === activeGroupId ? 0 : 1, borderColor: colors.line, backgroundColor: group.id === activeGroupId ? colors.lime : colors.raised }}>
            <Text weight="medium" style={{ fontSize: 13, color: group.id === activeGroupId ? colors.black : colors.muted }}>{group.name}</Text>
          </Pressable>)}
        </ScrollView> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginBottom: 15 }} contentContainerStyle={{ gap: 7, paddingHorizontal: 16 }}>
          {groupExercises.map((exercise) => <Pressable key={exercise.id} onPress={() => setChosenId(exercise.id)} accessibilityRole="button" accessibilityState={{ selected: exercise.id === chosen.id }} style={{ minHeight: 32, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center", borderWidth: exercise.id === chosen.id ? 0 : 1, borderColor: colors.line, backgroundColor: exercise.id === chosen.id ? colors.lime : colors.raised }}>
            <Text weight="medium" style={{ fontSize: 13, color: exercise.id === chosen.id ? colors.black : colors.muted }}>{exercise.name}</Text>
          </Pressable>)}
        </ScrollView>
        <ExerciseInsights key={chosen.id} chosen={chosen} workouts={workouts} since={since} profileUnit={unit} loadMode={loadMode} setLoadMode={chooseLoadMode} period={period} onPeriodChange={onPeriodChange} groupName={groups.find((group) => group.id === chosen.groupId)?.name} />
      </> : <Text tone="muted">{t("stats.emptyPeriod")}</Text>}
    </Card>
  </>;
}
