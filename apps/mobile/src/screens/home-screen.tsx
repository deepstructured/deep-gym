import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Pressable, ScrollView, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { activityByDate, weeklyBuckets, workingSets } from "@deepgym/core/analytics";
import { translateCount } from "@deepgym/core/i18n";
import { nextScheduledWorkout } from "@deepgym/core/next-workout";
import { normalizeTrainingSchedule } from "@deepgym/core/training-schedule";
import type { Workout } from "@deepgym/core/types";
import { kgToUnit, roundWeight } from "@deepgym/core/weight";
import { useBodyWeightMeasurements } from "../data/body-weight";
import { draftIsEmpty, useWorkoutDraft } from "../data/draft";
import { exerciseHistory, exerciseProgress, type ProgressMetric } from "../data/exercise-detail";
import { colors } from "../theme";
import { BottomSheet, Button, Card, Chip, DotValue, GradientCard, Screen, Segmented, Text } from "../ui";
import { useProfile, useWorkouts } from "../data/queries";
import { useAuth } from "../providers/auth-provider";
import { useI18n } from "../providers/locale-provider";
import { formatDate, fromISO, localISO, weekStreak } from "./format";
import { ErrorState, Header, LoadingState, WorkoutCard } from "./common";
import { useMobileHomeLayout } from "./home-layout";
import {
  WIDGETS,
  newWidgetId,
  type HomeWidget,
  type WidgetType,
} from "@deepgym/core/home-layout";

const EMPTY_WORKOUTS: Workout[] = [];
const PERIODS = ["1m", "3m", "6m", "1y", "all"] as const;
type Period = (typeof PERIODS)[number];
const EXTERNAL_METRICS: ProgressMetric[] = ["topSet", "oneRm", "volume", "reps"];
const BODYWEIGHT_METRICS: ProgressMetric[] = ["reps", "addedLoad"];
const MOBILE_WIDGET_TYPES = [
  "startWorkout", "weekActivity", "streak", "nextWorkout", "recentWorkouts",
  "exerciseProgress", "bodyWeight", "totalWorkouts", "consistency",
] as const satisfies readonly WidgetType[];
type MobileWidgetType = (typeof MOBILE_WIDGET_TYPES)[number];
type MobileWidget = HomeWidget & { type: MobileWidgetType };

function isMobileWidget(widget: HomeWidget): widget is MobileWidget {
  return (MOBILE_WIDGET_TYPES as readonly string[]).includes(widget.type);
}

/** Consecutive small widgets share a row; wide widgets keep their order. */
function mobileRows(widgets: MobileWidget[]): MobileWidget[][] {
  const rows: MobileWidget[][] = [];
  let waiting: MobileWidget | null = null;
  for (const widget of widgets) {
    if (widget.size === "s") {
      if (waiting) {
        rows.push([waiting, widget]);
        waiting = null;
      } else waiting = widget;
    } else {
      if (waiting) rows.push([waiting]);
      waiting = null;
      rows.push([widget]);
    }
  }
  if (waiting) rows.push([waiting]);
  return rows;
}

function periodStart(period: Period, today: Date): string | null {
  if (period === "all") return null;
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (period === "1y") date.setFullYear(date.getFullYear() - 1);
  else date.setMonth(date.getMonth() - Number(period[0]));
  date.setDate(date.getDate() + 1);
  return localISO(date);
}

function Sparkline({ values, color = colors.lime, height = 72 }: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const [width, setWidth] = useState(220);
  if (values.length === 0) return null;
  const padding = 5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.01);
  const points = values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : padding + (index / (values.length - 1)) * (width - padding * 2),
    y: height - padding - ((value - min) / range) * (height - padding * 2),
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const area = `${path} L${last.x} ${height} L${first.x} ${height} Z`;
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.max(1, event.nativeEvent.layout.width);
    if (Math.abs(next - width) > 1) setWidth(next);
  };
  return (
    <View onLayout={onLayout} style={{ width: "100%", height }} accessibilityElementsHidden>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.22} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {values.length > 1 ? <Path d={area} fill="url(#sparkFill)" /> : null}
        {values.length > 1 ? <Path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /> : null}
        <Circle cx={last.x} cy={last.y} r={3.5} fill={color} />
      </Svg>
    </View>
  );
}

function StatCard({ label, value, suffix, indigo = false, footer }: {
  label: string;
  value: number;
  suffix?: string;
  indigo?: boolean;
  footer?: ReactNode;
}) {
  const content = (
    <View style={{ minHeight: 118, justifyContent: "space-between" }}>
      <Text variant="micro" tone={indigo ? "white" : "muted"}>{label}</Text>
      <DotValue value={value} suffix={suffix} size={36} color={indigo ? colors.white : colors.lime} />
      {footer ?? <View style={{ height: 11 }} />}
    </View>
  );
  return indigo ? (
    <GradientCard variant="indigo" style={{ flex: 1 }} padding={16}>{content}</GradientCard>
  ) : (
    <Card variant="stat" style={{ flex: 1 }} padding={16}>{content}</Card>
  );
}

function WeekBars({ workouts, schedule, today }: {
  workouts: Workout[];
  schedule: ReturnType<typeof normalizeTrainingSchedule>;
  today: Date;
}) {
  const weekday = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekday);
  const dates = new Set(workouts.map((workout) => workout.date));
  return (
    <View style={{ flexDirection: "row", gap: 5, height: 15, alignItems: "flex-end" }} accessibilityElementsHidden>
      {schedule.map((planned, index) => {
        const date = localISO(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index));
        const done = dates.has(date);
        return (
          <View key={index} style={{
            flex: 1, height: done ? 15 : index === weekday ? 9 : 6, borderRadius: 3,
            backgroundColor: done ? colors.lime : index > weekday && planned
              ? "rgba(215,246,81,0.35)" : index === weekday ? "rgba(215,246,81,0.17)" : colors.line,
          }} />
        );
      })}
    </View>
  );
}

function ConsistencyHeatmap({ workouts, today }: { workouts: Workout[]; today: Date }) {
  const { t, lang } = useI18n();
  const weeks = 20;
  const activity = activityByDate(workouts);
  const buckets = weeklyBuckets(workouts, weeks, today);
  const activeWeeks = buckets.filter((bucket) => bucket.workouts > 0).length;
  const todayISO = localISO(today);
  const weekday = (today.getDay() + 6) % 7;
  const firstMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekday - (weeks - 1) * 7);
  return (
    <Pressable onPress={() => router.push("/progress")} accessibilityRole="button" accessibilityLabel={t("widget.consistency.title")}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="micro" tone="muted">{t("widget.consistency.title")}</Text>
          <Text variant="caption" tone="faint">{translateCount(lang, "widget.consistency.weeks", weeks)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 18, marginBottom: 5 }}>
          <Text variant="caption" tone="faint">{firstMonday.toLocaleDateString(lang, { month: "short" })}</Text>
          <Text variant="caption" tone="faint">{today.toLocaleDateString(lang, { month: "short" })}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 3 }} accessibilityElementsHidden>
          {buckets.map((bucket, week) => (
            <View key={bucket.start} style={{ flex: 1, gap: 3 }}>
              {Array.from({ length: 7 }, (_, day) => {
                const date = localISO(new Date(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate() + week * 7 + day));
                const count = activity.get(date) ?? 0;
                return <View key={date} style={{
                  width: "100%", aspectRatio: 1, borderRadius: 2,
                  backgroundColor: date > todayISO ? "#151518" : count > 1 ? colors.lime : count === 1 ? "#8aa730" : colors.raised,
                  borderWidth: date === todayISO && count === 0 ? 1 : 0,
                  borderColor: colors.lime,
                }} />;
              })}
            </View>
          ))}
        </View>
        <Text variant="caption" tone="muted" style={{ marginTop: 13 }}>
          {t("widget.consistency.activeWeeks")}: {Math.round((activeWeeks / weeks) * 100)}%
        </Text>
      </Card>
    </Pressable>
  );
}

function FirstWorkoutGuide() {
  const { t } = useI18n();
  const steps = ["firstWorkout.stepType", "firstWorkout.stepExercise", "firstWorkout.stepSave"] as const;
  return (
    <Card variant="live" style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(215,246,81,0.1)" }}>
          <Ionicons name="barbell-outline" size={20} color={colors.lime} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title">{t("firstWorkout.guideTitle")}</Text>
          <Text tone="muted" style={{ marginTop: 4 }}>{t("firstWorkout.guideBody")}</Text>
        </View>
      </View>
      <View style={{ gap: 12, marginVertical: 19 }}>
        {steps.map((key, index) => (
          <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.raised }}>
              <DotValue value={index + 1} size={14} color={colors.lime} />
            </View>
            <Text style={{ flex: 1 }}>{t(key)}</Text>
          </View>
        ))}
      </View>
      <Button variant="lime" block onPress={() => router.push({ pathname: "/new", params: { first: "1" } })}>
        {t("firstWorkout.open")}
      </Button>
    </Card>
  );
}

export function HomeScreen() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const profile = useProfile();
  const workouts = useWorkouts();
  const { layout, isCustom, save, reset, saving, error: layoutError } = useMobileHomeLayout(profile.data);
  const bodyWeight = useBodyWeightMeasurements({ limit: 30 });
  const draft = useWorkoutDraft((state) => state.draft);
  const draftOwnerId = useWorkoutDraft((state) => state.ownerId);
  const draftReady = useWorkoutDraft((state) => state.syncReady);
  const [selectedExerciseOverride, setSelectedExerciseOverride] = useState<string | null | undefined>(undefined);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [metricOverride, setMetricOverride] = useState<ProgressMetric | null>(null);
  const [period, setPeriod] = useState<Period>("3m");
  const [customizeOpen, setCustomizeOpen] = useState(false);

  useEffect(() => {
    setSelectedExerciseOverride(undefined);
    setMetricOverride(null);
    setExercisePickerOpen(false);
    setCustomizeOpen(false);
  }, [user?.id]);

  const mobileWidgets = layout.widgets.filter(isMobileWidget);
  const rows = mobileRows(mobileWidgets);
  const hiddenTypes = MOBILE_WIDGET_TYPES.filter((type) =>
    !mobileWidgets.some((widget) => widget.type === type),
  );
  const chartWidget = mobileWidgets.find((widget) => widget.type === "exerciseProgress");
  const selectedExerciseId = selectedExerciseOverride !== undefined
    ? selectedExerciseOverride
    : chartWidget?.config?.exerciseId ?? null;
  const storedMetric = chartWidget?.config?.metric;
  const metric = metricOverride ?? (
    EXTERNAL_METRICS.includes(storedMetric as ProgressMetric) || BODYWEIGHT_METRICS.includes(storedMetric as ProgressMetric)
      ? storedMetric as ProgressMetric
      : "topSet"
  );

  function commit(widgets: HomeWidget[]) {
    save({ version: 1, widgets });
  }

  function moveWidget(id: string, direction: -1 | 1) {
    const positions = layout.widgets.flatMap((widget, index) => isMobileWidget(widget) ? [index] : []);
    const from = positions.findIndex((index) => layout.widgets[index].id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= positions.length) return;
    const next = [...layout.widgets];
    [next[positions[from]], next[positions[to]]] = [next[positions[to]], next[positions[from]]];
    commit(next);
  }

  function addWidget(type: MobileWidgetType) {
    if (layout.widgets.some((widget) => widget.type === type)) return;
    if (type === "exerciseProgress") {
      setSelectedExerciseOverride(undefined);
      setMetricOverride(null);
    }
    commit([...layout.widgets, { id: newWidgetId(type), type, size: WIDGETS[type].sizes[0] }]);
  }

  function hideWidget(widget: MobileWidget) {
    if (widget.type === "exerciseProgress") {
      setSelectedExerciseOverride(undefined);
      setMetricOverride(null);
    }
    commit(layout.widgets.filter((item) => item.id !== widget.id));
  }

  function patchChartConfig(patch: { exerciseId?: string; metric?: string }) {
    if (!chartWidget) return;
    commit(layout.widgets.map((widget) => widget.id === chartWidget.id
      ? { ...widget, config: { ...widget.config, ...patch } }
      : widget));
  }

  const today = new Date();
  const todayISO = localISO(today);
  const history = workouts.data ?? EMPTY_WORKOUTS;
  const hasDraft = draftReady && draftOwnerId === user?.id && !draftIsEmpty(draft);
  const filledSets = draft.exercises.reduce(
    (sum, entry) => sum + entry.sets.filter((set) => set.weight.trim() || set.reps.trim()).length,
    0,
  );
  const schedule = normalizeTrainingSchedule(profile.data?.training_schedule);
  const next = nextScheduledWorkout(profile.data?.training_schedule, history, today);
  const weekCount = weeklyBuckets(history, 1, today)[0]?.workouts ?? 0;
  const monthStart = localISO(new Date(today.getFullYear(), today.getMonth(), 1));
  const thisMonth = history.filter((workout) => workout.date >= monthStart).length;

  const recentExercises = useMemo(() => {
    const found = new Map<string, { id: string; name: string; unit: "kg" | "lb" | null; bodyweight: boolean }>();
    for (const workout of history) {
      for (const occurrence of workout.workout_exercises) {
        if (found.has(occurrence.exercise_id) || workingSets(occurrence.sets).length === 0) continue;
        found.set(occurrence.exercise_id, {
          id: occurrence.exercise_id,
          name: occurrence.exercise?.name ?? t("exercises.title"),
          unit: occurrence.exercise?.unit ?? null,
          bodyweight: occurrence.load_mode === "bodyweight",
        });
      }
    }
    return [...found.values()];
  }, [history, t]);
  const selected = recentExercises.find((item) => item.id === selectedExerciseId) ?? recentExercises[0];
  const allowedMetrics = selected?.bodyweight ? BODYWEIGHT_METRICS : EXTERNAL_METRICS;
  const activeMetric = allowedMetrics.includes(metric) ? metric : allowedMetrics[0];
  const exerciseUnit = selected?.unit ?? profile.data?.unit ?? "kg";
  const exercisePoints = useMemo(() => {
    if (!selected) return [];
    const since = periodStart(period, today);
    return exerciseProgress(exerciseHistory(history, selected.id), activeMetric)
      .filter((point) => !since || point.date >= since)
      .map((point) => ({
        ...point,
        displayValue: activeMetric === "reps" ? point.value : kgToUnit(point.value, exerciseUnit),
      }));
  }, [history, selected?.id, activeMetric, period, exerciseUnit, todayISO]);
  const latestPoint = exercisePoints[exercisePoints.length - 1];
  const oldestPoint = exercisePoints[0];
  const metricValue = (value: number) => activeMetric === "reps"
    ? String(Math.round(value))
    : activeMetric === "volume"
      ? Math.round(value).toLocaleString(lang)
      : `${activeMetric === "addedLoad" && value > 0 ? "+" : ""}${roundWeight(value)}`;

  const weightRows = bodyWeight.data ?? [];
  const currentWeight = profile.data?.body_weight_kg ?? weightRows[0]?.weight_kg ?? null;
  const oldestWeight = weightRows[weightRows.length - 1]?.weight_kg;
  const weightChange = currentWeight != null && oldestWeight != null && weightRows.length > 1
    ? roundWeight(kgToUnit(currentWeight - oldestWeight, profile.data?.unit ?? "kg"))
    : null;

  function renderWidget(type: MobileWidgetType): ReactNode {
    const currentProfile = profile.data;
    if (!currentProfile) return null;

    switch (type) {
      case "startWorkout":
        return (
          <Pressable onPress={() => router.push("/new")} accessibilityRole="button">
            {hasDraft ? (
              <Card variant="live" style={{ minHeight: 164 }}>
                <View style={{ flex: 1, justifyContent: "space-between" }}>
                  <Text variant="micro" tone="lime">● {t("draft.inProgress")}</Text>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="title">{draft.type}</Text>
                      <Text variant="caption" tone="muted" style={{ marginTop: 3 }}>
                        {translateCount(lang, "count.exercises", draft.exercises.length)} · {translateCount(lang, "count.sets", filledSets)}
                      </Text>
                    </View>
                    <Text tone="lime" weight="semibold">{t("draft.continueShort")} ›</Text>
                  </View>
                </View>
              </Card>
            ) : (
              <GradientCard variant="pink" style={{ minHeight: 136 }}>
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                  <Text variant="title">{t("home.startWorkout")}</Text>
                  <Text variant="caption" tone="muted">{t("home.logSession")}</Text>
                </View>
              </GradientCard>
            )}
          </Pressable>
        );

      case "weekActivity":
        return (
          <Pressable style={{ flex: 1 }} onPress={() => router.push("/history")} accessibilityRole="button">
            <StatCard label={t("home.workoutsThisWeek")} value={weekCount} footer={<WeekBars workouts={history} schedule={schedule} today={today} />} />
          </Pressable>
        );

      case "streak":
        return (
          <Pressable style={{ flex: 1 }} onPress={() => router.push("/history")} accessibilityRole="button">
            <StatCard label={t("home.weekStreak")} value={weekStreak(history, today)} suffix={t("home.wk")} indigo />
          </Pressable>
        );

      case "nextWorkout":
        return (
          <Pressable
            onPress={() => next
              ? router.push({ pathname: "/new", params: { type: next.type, date: next.date } })
              : router.push({ pathname: "/settings", params: { open: "schedule" } })}
            accessibilityRole="button"
          >
            <GradientCard variant="cherry" style={{ minHeight: 162 }}>
              <Text variant="micro" tone="muted">{t("home.nextWorkout")}</Text>
              {next ? <>
                <Text variant="title" style={{ marginTop: 7 }}>
                  {next.daysAway === 0 ? t("home.today") : formatDate(next.date, lang)}
                </Text>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <DotValue value={Number(next.date.slice(-2))} suffix={fromISO(next.date).toLocaleDateString(lang, { month: "short" }).toUpperCase()} size={45} />
                  <Text variant="title">{next.type}</Text>
                </View>
              </> : (
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                  <Text variant="title">{t("widget.nextWorkout.planTitle")} ›</Text>
                  <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>{t("widget.nextWorkout.planHint")}</Text>
                </View>
              )}
            </GradientCard>
          </Pressable>
        );

      case "recentWorkouts":
        return (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
              <Text variant="title">{t("widget.recentWorkouts.name")}</Text>
              <Text tone="muted" onPress={() => router.push("/history")}>{t("home.allHistory")} ›</Text>
            </View>
            {history.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
                {history.slice(0, 3).map((workout) => (
                  <View key={workout.id} style={{ width: 280 }}>
                    <WorkoutCard workout={workout} unit={currentProfile.unit} onPress={() => router.push({ pathname: "/workouts/[id]", params: { id: workout.id } })} />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Card><Text tone="muted">{t("home.emptyHint")}</Text></Card>
            )}
          </View>
        );

      case "exerciseProgress":
        return (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <Pressable onPress={() => setExercisePickerOpen(true)} disabled={!selected} style={{ flex: 1 }} accessibilityRole="button">
                <Text variant="title" numberOfLines={1}>{selected?.name ?? t("home.progress")}{selected ? " ⌄" : ""}</Text>
              </Pressable>
              {selected ? (
                <Text variant="caption" tone="muted" onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: selected.id } })}>
                  {t("home.details")} ›
                </Text>
              ) : null}
            </View>
            {selected ? <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 14 }}>
                {allowedMetrics.map((option) => (
                  <Chip key={option} selected={activeMetric === option} onPress={() => { setMetricOverride(option); patchChartConfig({ metric: option }); }}>
                    {t(`stats.metric.${option}`)}
                  </Chip>
                ))}
              </ScrollView>
              <Segmented value={period} onChange={setPeriod} options={PERIODS.map((option) => ({ value: option, label: t(`period.${option}`) }))} />
              {latestPoint ? <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 17 }}>
                  <View>
                    <Text variant="micro" tone="muted">{t(`stats.metric.${activeMetric}`)}</Text>
                    <DotValue value={metricValue(latestPoint.displayValue)} suffix={activeMetric === "reps" ? undefined : exerciseUnit} size={31} color={colors.lime} />
                  </View>
                  {oldestPoint && exercisePoints.length > 1 ? (
                    <Text variant="caption" tone={latestPoint.displayValue >= oldestPoint.displayValue ? "lime" : "pink"}>
                      {latestPoint.displayValue - oldestPoint.displayValue >= 0 ? "+" : ""}
                      {metricValue(latestPoint.displayValue - oldestPoint.displayValue)} {activeMetric === "reps" ? "" : exerciseUnit}
                    </Text>
                  ) : null}
                </View>
                <View style={{ marginTop: 11 }}><Sparkline values={exercisePoints.map((point) => point.displayValue)} /></View>
              </> : <Text tone="muted" style={{ marginTop: 22 }}>{t("stats.emptyPeriod")}</Text>}
            </> : <Text tone="muted" style={{ marginTop: 15 }}>{t("widget.exerciseProgress.empty")}</Text>}
          </Card>
        );

      case "bodyWeight":
        return (
          <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: "/settings", params: { open: "weight" } })} accessibilityRole="button">
            <Card variant="stat" padding={16} style={{ minHeight: 145, flex: 1 }}>
              <Text variant="micro" tone="lime">{t("bodyWeight.title")}</Text>
              {currentWeight == null ? (
                <Text variant="caption" tone="muted" style={{ marginTop: 17 }}>{t("widget.bodyWeight.empty")}</Text>
              ) : <>
                <DotValue value={roundWeight(kgToUnit(currentWeight, currentProfile.unit))} suffix={currentProfile.unit} size={30} style={{ marginTop: 12 }} />
                {weightChange != null ? (
                  <Text variant="caption" tone="muted">{weightChange > 0 ? "+" : ""}{weightChange} {currentProfile.unit}</Text>
                ) : null}
                {weightRows.length > 1 ? (
                  <View style={{ marginTop: 8 }}><Sparkline values={[...weightRows].reverse().map((row) => row.weight_kg)} height={32} /></View>
                ) : null}
              </>}
            </Card>
          </Pressable>
        );

      case "totalWorkouts":
        return (
          <Pressable style={{ flex: 1 }} onPress={() => router.push("/history")} accessibilityRole="button">
            <Card variant="stat" padding={16} style={{ minHeight: 145, flex: 1 }}>
              <Text variant="micro" tone="muted">{t("home.totalWorkouts")}</Text>
              <View style={{ flex: 1, justifyContent: "flex-end" }}>
                <DotValue value={history.length} size={36} />
                {thisMonth > 0 ? (
                  <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>{t("widget.totalWorkouts.thisMonth", { n: thisMonth })}</Text>
                ) : null}
              </View>
            </Card>
          </Pressable>
        );

      case "consistency":
        return <ConsistencyHeatmap workouts={history} today={today} />;
    }
  }

  return (
    <Screen bottomPadding={122}>
      <View style={{ marginTop: 4, marginBottom: 15 }}>
        <Header
          title={t("home.greeting", {
            name: profile.data?.display_name?.split(" ")[0] ?? t("home.athlete"),
          })}
          profile={profile.data}
          action={profile.data ? (
            <Pressable onPress={() => setCustomizeOpen(true)} accessibilityRole="button" accessibilityLabel={t("dashboard.customize")}
              style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.raised }}>
              <Ionicons name="grid-outline" size={18} color={colors.lime} />
            </Pressable>
          ) : null}
        />
        <Text variant="caption" tone="muted" style={{ marginTop: -2, marginLeft: 27 }}>
          {today.toLocaleDateString(lang, { weekday: "long", month: "long", day: "numeric" })}
        </Text>
      </View>

      {(profile.isLoading || workouts.isLoading) && !profile.data && !workouts.data && !profile.error && !workouts.error ? <LoadingState /> : null}
      {(!profile.data && profile.error) || (!workouts.data && workouts.error) ? (
        <ErrorState
          message={String(profile.error?.message ?? workouts.error?.message)}
          retry={() => { profile.refetch(); workouts.refetch(); }}
        />
      ) : null}

      {profile.data && workouts.data ? <>
        {history.length === 0 ? <FirstWorkoutGuide /> : null}
        {rows.length ? rows.map((row) => (
          <View key={row.map((widget) => widget.id).join(":")} style={{
            flexDirection: "row", gap: 12,
            marginBottom: row.some((widget) => widget.type === "nextWorkout" || widget.type === "recentWorkouts") ? 23 : 13,
          }}>
            {row.map((widget) => (
              <View key={widget.id} style={{ flex: 1, minWidth: 0 }}>
                {renderWidget(widget.type)}
              </View>
            ))}
          </View>
        )) : (
          <Pressable onPress={() => setCustomizeOpen(true)} accessibilityRole="button" style={{ marginBottom: 13 }}>
            <Card><Text tone="muted">{t("dashboard.empty")}</Text></Card>
          </Pressable>
        )}

        <Button variant="ghost" block onPress={() => setCustomizeOpen(true)} style={{ marginTop: 7, marginBottom: 18 }}>
          {t("dashboard.customize")}
        </Button>

        <BottomSheet
          open={customizeOpen}
          onClose={() => setCustomizeOpen(false)}
          title={t("dashboard.customize")}
          closeLabel={t("common.close")}
          footer={<Button variant="lime" block onPress={() => setCustomizeOpen(false)}>{t("dashboard.done")}</Button>}
        >
          <View style={{ gap: 8, paddingBottom: 16 }}>
            {mobileWidgets.map((widget, index) => {
              const name = t(`widget.${widget.type}.name`);
              return (
                <View key={widget.id} style={{
                  minHeight: 55, borderRadius: 14, backgroundColor: colors.raised,
                  flexDirection: "row", alignItems: "center", paddingLeft: 13, paddingRight: 5,
                }}>
                  <Text weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{name}</Text>
                  <Pressable onPress={() => moveWidget(widget.id, -1)} disabled={index === 0}
                    accessibilityRole="button" accessibilityLabel={t("templates.moveUp", { name })}
                    style={{ width: 38, height: 44, alignItems: "center", justifyContent: "center", opacity: index === 0 ? 0.3 : 1 }}>
                    <Ionicons name="chevron-up" size={19} color={colors.text} />
                  </Pressable>
                  <Pressable onPress={() => moveWidget(widget.id, 1)} disabled={index === mobileWidgets.length - 1}
                    accessibilityRole="button" accessibilityLabel={t("templates.moveDown", { name })}
                    style={{ width: 38, height: 44, alignItems: "center", justifyContent: "center", opacity: index === mobileWidgets.length - 1 ? 0.3 : 1 }}>
                    <Ionicons name="chevron-down" size={19} color={colors.text} />
                  </Pressable>
                  <Pressable onPress={() => hideWidget(widget)}
                    accessibilityRole="button" accessibilityLabel={`${t("dashboard.remove")}: ${name}`}
                    style={{ width: 38, height: 44, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="eye-off-outline" size={19} color={colors.pink} />
                  </Pressable>
                </View>
              );
            })}
            {hiddenTypes.length ? <Text variant="micro" tone="faint" style={{ marginTop: 13, marginLeft: 7 }}>
              {t("dashboard.addWidget")}
            </Text> : null}
            {hiddenTypes.map((type) => (
              <Pressable key={type} onPress={() => addWidget(type)} accessibilityRole="button"
                accessibilityLabel={`${t("dashboard.addWidget")}: ${t(`widget.${type}.name`)}`}
                style={{ minHeight: 51, borderRadius: 14, borderWidth: 1, borderColor: colors.line,
                  flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 }}>
                <Text tone="muted" style={{ flex: 1 }}>{t(`widget.${type}.name`)}</Text>
                <Ionicons name="add-circle-outline" size={22} color={colors.lime} />
              </Pressable>
            ))}
            {isCustom ? (
              <Button variant="ghost" block onPress={() => Alert.alert(
                t("dashboard.resetTitle"), t("dashboard.resetMessage"), [
                  { text: t("common.cancel"), style: "cancel" },
                  { text: t("dashboard.reset"), style: "destructive", onPress: reset },
                ],
              )} style={{ marginTop: 9 }}>
                {t("dashboard.reset")}
              </Button>
            ) : null}
            {saving ? <Text variant="caption" tone="faint">{t("common.loading")}</Text> : null}
            {layoutError ? <Text variant="caption" tone="pink">{t("common.error")}</Text> : null}
          </View>
        </BottomSheet>

        <BottomSheet open={exercisePickerOpen} onClose={() => setExercisePickerOpen(false)} title={t("widget.exerciseProgress.pick")} closeLabel={t("common.close")}>
          <View style={{ gap: 8, paddingBottom: 18 }}>
            <Chip selected={!selectedExerciseId} onPress={() => { setSelectedExerciseOverride(null); patchChartConfig({ exerciseId: undefined }); setExercisePickerOpen(false); }}>
              {t("widget.exerciseProgress.auto")}
            </Chip>
            <Text variant="caption" tone="muted">{t("widget.exerciseProgress.autoHint")}</Text>
            {recentExercises.map((item) => (
              <Pressable key={item.id} onPress={() => { setSelectedExerciseOverride(item.id); patchChartConfig({ exerciseId: item.id }); setExercisePickerOpen(false); }} accessibilityRole="button"
                style={{ minHeight: 48, paddingHorizontal: 14, justifyContent: "center", borderRadius: 13,
                  backgroundColor: selectedExerciseId === item.id ? "rgba(215,246,81,0.12)" : colors.raised }}>
                <Text tone={selectedExerciseId === item.id ? "lime" : "primary"}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        </BottomSheet>
      </> : null}
    </Screen>
  );
}
