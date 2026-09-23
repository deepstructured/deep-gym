import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Alert, Image, LayoutAnimation, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { activityByDate, weeklyBuckets, workingSets, workoutSetCount } from "@deepgym/core/analytics";
import { translateCount } from "@deepgym/core/i18n";
import { nextScheduledWorkout } from "@deepgym/core/next-workout";
import { normalizeTrainingSchedule } from "@deepgym/core/training-schedule";
import type { Workout } from "@deepgym/core/types";
import { kgToUnit, roundWeight } from "@deepgym/core/weight";
import { useBodyWeightMeasurements } from "../data/body-weight";
import { draftIsEmpty, useWorkoutDraft } from "../data/draft";
import { exerciseHistory, exerciseProgress, type ProgressMetric } from "../data/exercise-detail";
import { avatarSource } from "../lib/avatar-source";
import { colors, spacing } from "../theme";
import { BottomSheet, BrandMark, Button, Card, Chip, DotValue, GradientCard, Screen, Text } from "../ui";
import { useProfile, useWorkouts } from "../data/queries";
import { useAuth } from "../providers/auth-provider";
import { useI18n } from "../providers/locale-provider";
import { formatDate, localISO, weekStreak } from "./format";
import { ErrorState, LoadingState, WorkoutCard } from "./common";
import { ScheduledWorkoutCard } from "./scheduled-workout-card";
import { HomeExtraWidget } from "./home-extra-widgets";
import { lookbackStart } from "./period-range";
import { filterByLoad, loadOptions, type LoadFilter } from "./progress-analytics";
import { ChartPeriodSwitch, MetricInfoContent, MetricInfoSheet, ProgressTrendLine } from "./progress-extras";
import { usePreferredPeriod } from "./use-preferred-period";
import { useMobileHomeLayout } from "./home-layout";
import { HomeTileHead, HomeTileIcon, type TileIconName } from "./home-tile-icons";
import {
  WIDGETS, WIDGET_TYPES,
  newWidgetId,
  type HomeWidget,
  type WidgetSize,
  type WidgetType,
} from "@deepgym/core/home-layout";

const EMPTY_WORKOUTS: Workout[] = [];
const EXTERNAL_METRICS: ProgressMetric[] = ["topSet", "oneRm", "volume", "reps"];
const BODYWEIGHT_METRICS: ProgressMetric[] = ["reps", "addedLoad"];
const MOBILE_WIDGET_TYPES = WIDGET_TYPES;
type MobileWidgetType = (typeof MOBILE_WIDGET_TYPES)[number];
type MobileWidget = HomeWidget & { type: MobileWidgetType };

function isMobileWidget(widget: HomeWidget): widget is MobileWidget {
  return (MOBILE_WIDGET_TYPES as readonly string[]).includes(widget.type);
}

/** Match the PWA's `grid-auto-flow: row dense`: a later small tile fills a gap. */
function mobileRows(widgets: MobileWidget[]): MobileWidget[][] {
  const rows: MobileWidget[][] = [];
  for (const widget of widgets) {
    if (widget.size === "s") {
      const gap = rows.find((row) => row.length === 1 && row[0].size === "s");
      if (gap) gap.push(widget);
      else rows.push([widget]);
    } else {
      rows.push([widget]);
    }
  }
  return rows;
}

interface WidgetFrame { x: number; y: number; width: number; height: number }

function dropTargetAt(frames: Map<string, WidgetFrame>, activeId: string, x: number, y: number): string | null {
  let closest: string | null = null;
  let distance = Infinity;
  for (const [id, frame] of frames) {
    if (id === activeId) continue;
    const dx = Math.max(frame.x - x, 0, x - frame.x - frame.width);
    const dy = Math.max(frame.y - y, 0, y - frame.y - frame.height);
    const next = Math.hypot(dx, dy);
    if (next < distance) {
      closest = id;
      distance = next;
    }
  }
  return distance <= 28 ? closest : null;
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

function StatCard({ label, value, suffix, indigo = false, footer, icon }: {
  label: string;
  value: number;
  suffix?: string;
  indigo?: boolean;
  footer?: ReactNode;
  icon?: TileIconName;
}) {
  const content = (
    <View style={{ minHeight: 118, justifyContent: "space-between" }}>
      <HomeTileHead label={label} icon={icon} tone={indigo ? "white" : "lime"} />
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

function WeekBars({ workouts, schedule, today, expanded = false }: {
  workouts: Workout[];
  schedule: ReturnType<typeof normalizeTrainingSchedule>;
  today: Date;
  expanded?: boolean;
}) {
  const weekday = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekday);
  const dates = new Set(workouts.map((workout) => workout.date));
  return (
    <View style={{ flexDirection: "row", gap: 5, height: expanded ? 34 : 15, alignItems: "flex-end" }} accessibilityElementsHidden>
      {schedule.map((planned, index) => {
        const date = localISO(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index));
        const done = dates.has(date);
        return (
          <View key={index} style={{ flex: 1, alignItems: "center", gap: 5 }}>
            <View style={{
              width: expanded ? 8 : 4, height: done ? 15 : 6, borderRadius: 3,
              borderWidth: !done && index > weekday && planned ? 1 : 0,
              borderStyle: "dashed", borderColor: "rgba(255,255,255,0.3)",
              backgroundColor: done ? colors.lime : index === weekday ? "rgba(255,255,255,0.35)" :
                index > weekday && planned ? "transparent" : "rgba(255,255,255,0.12)",
            }} />
            {expanded ? <Text variant="micro" tone={index === weekday ? "white" : "faint"} style={{ fontSize: 9, letterSpacing: 0 }}>
              {new Date(2024, 0, 1 + index).toLocaleDateString("en", { weekday: "narrow" })}
            </Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function ConsistencyHeatmap({ workouts, today, size }: { workouts: Workout[]; today: Date; size: WidgetSize }) {
  const { t, lang } = useI18n();
  const [heatmapWidth, setHeatmapWidth] = useState(0);
  const weeks = size === "l" ? 26 : 20;
  const activity = activityByDate(workouts);
  const buckets = weeklyBuckets(workouts, weeks, today);
  const activeWeeks = buckets.filter((bucket) => bucket.workouts > 0).length;
  const todayISO = localISO(today);
  const weekday = (today.getDay() + 6) % 7;
  const firstMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekday - (weeks - 1) * 7);
  const monthLabels = buckets.map((_, week) => {
    const date = new Date(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate() + week * 7);
    const previous = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7);
    return week === 0 || date.getMonth() !== previous.getMonth() ? date.toLocaleDateString(lang, { month: "short" }) : "";
  });
  return (
    <Pressable onPress={() => router.push("/progress")} accessibilityRole="button" accessibilityLabel={t("widget.consistency.title")}>
      <Card variant="stat" padding={16} radius={22}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="micro" tone="muted">{t("widget.consistency.title")}</Text>
          <Text variant="caption" tone="faint">{translateCount(lang, "widget.consistency.weeks", weeks)}</Text>
        </View>
        <View onLayout={(event) => setHeatmapWidth(event.nativeEvent.layout.width)}
          style={{ height: 16, marginTop: 18, marginBottom: 5 }}>
          {monthLabels.map((label, index) => label ? <Text key={index} variant="caption" tone="faint" numberOfLines={1}
            style={{ position: "absolute", left: index * ((heatmapWidth - (weeks - 1) * 3) / weeks + 3),
              width: 36, fontSize: 9 }}>{label}</Text> : null)}
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
        {size === "l" ? <View style={{ flexDirection: "row", gap: 8, marginTop: 17 }}>
          {[
            { label: t("progress.workouts"), value: buckets.reduce((sum, bucket) => sum + bucket.workouts, 0) },
            { label: t("widget.consistency.activeWeeks"), value: `${Math.round((activeWeeks / weeks) * 100)}%` },
            { label: t("home.weekStreak"), value: weekStreak(workouts, today) },
          ].map((item) => <View key={item.label} style={{ flex: 1 }}>
            <Text variant="micro" tone="muted" numberOfLines={1}>{item.label}</Text>
            <DotValue value={item.value} size={19} />
          </View>)}
        </View> : null}
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

interface DraggableWidgetProps {
  widget: MobileWidget;
  editing: boolean;
  dragging: boolean;
  dropTarget: boolean;
  scrollCompensation: Animated.Value;
  onMount: (id: string, node: View | null) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number, moved: boolean) => void;
  onRemove: () => void;
  onResize: (size: WidgetSize) => void;
  onLongPress: () => void;
  children: ReactNode;
}

function DraggableWidget({
  widget, editing, dragging, dropTarget, scrollCompensation, onMount, onDragStart, onDragMove,
  onDragEnd, onRemove, onResize, onLongPress, children,
}: DraggableWidgetProps) {
  const { t } = useI18n();
  const translation = useRef(new Animated.ValueXY()).current;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressFired = useRef(false);
  const clearLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    longPressStart.current = null;
  };
  useEffect(() => clearLongPress, []);
  const touchStart = (event: GestureResponderEvent) => {
    if (editing) return;
    clearLongPress();
    longPressFired.current = false;
    longPressStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onLongPress();
      clearLongPress();
    }, 550);
  };
  const touchMove = (event: GestureResponderEvent) => {
    if (!longPressStart.current) return;
    if (Math.abs(event.nativeEvent.pageX - longPressStart.current.x) > 8 ||
      Math.abs(event.nativeEvent.pageY - longPressStart.current.y) > 8) clearLongPress();
  };
  const measureRef = useCallback((node: View | null) => onMount(widget.id, node), [onMount, widget.id]);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      translation.setValue({ x: 0, y: 0 });
      onDragStart(widget.id);
    },
    onPanResponderMove: (_, gesture) => {
      translation.setValue({ x: gesture.dx, y: gesture.dy });
      onDragMove(widget.id, gesture.moveX, gesture.moveY);
    },
    onPanResponderRelease: (_, gesture) => {
      translation.setValue({ x: 0, y: 0 });
      onDragEnd(widget.id, gesture.moveX, gesture.moveY, Math.hypot(gesture.dx, gesture.dy) >= 10);
    },
    onPanResponderTerminate: (_, gesture) => {
      translation.setValue({ x: 0, y: 0 });
      onDragEnd(widget.id, gesture.moveX, gesture.moveY, false);
    },
    onPanResponderTerminationRequest: () => false,
  }), [onDragEnd, onDragMove, onDragStart, translation, widget.id]);

  return (
    <View ref={measureRef} onTouchStart={touchStart} onTouchMove={touchMove}
      onTouchEndCapture={(event) => { clearLongPress(); if (longPressFired.current) { event.stopPropagation(); longPressFired.current = false; } }}
      onTouchCancel={clearLongPress}
      style={{ flex: 1, minWidth: 0, zIndex: dragging ? 10 : 0 }}>
      <Animated.View style={{ flex: 1, transform: [
        { translateX: translation.x },
        { translateY: Animated.add(translation.y, dragging ? scrollCompensation : 0) },
        { scale: dragging ? 1.025 : 1 },
      ] }}>
        {children}
        {editing ? <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Pressable
            accessible={false}
            onPress={() => {}}
            style={[StyleSheet.absoluteFill, { borderRadius: 20, backgroundColor: dragging ? "rgba(215,246,81,0.07)" : "rgba(0,0,0,0.08)" }]}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
            borderRadius: 20, borderWidth: dropTarget ? 2 : 1,
            borderColor: dropTarget ? colors.lime : "rgba(255,255,255,0.11)",
          }]} />
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`${t("dashboard.remove")}: ${t(`widget.${widget.type}.name`)}`}
            style={{ position: "absolute", left: -6, top: -6, zIndex: 3, width: 29, height: 29, borderRadius: 15,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "#33333a", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="remove" size={17} color={colors.text} />
          </Pressable>
          {WIDGETS[widget.type].sizes.length > 1 ? <View style={{ position: "absolute", top: -6, right: -5, zIndex: 3,
            flexDirection: "row", gap: 2, padding: 3, borderRadius: 20, backgroundColor: "#2e2e35",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
            {WIDGETS[widget.type].sizes.map((size) => <Pressable
              key={size}
              onPress={() => onResize(size)}
              accessibilityRole="button"
              accessibilityState={{ selected: widget.size === size }}
              accessibilityLabel={t(`dashboard.size.${size}`)}
              style={{ width: 29, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 15,
                backgroundColor: widget.size === size ? colors.lime : "transparent" }}
            >
              <Text weight="semibold" style={{ fontSize: 11, lineHeight: 15, color: widget.size === size ? colors.black : colors.muted }}>
                {size.toUpperCase()}
              </Text>
            </Pressable>)}
          </View> : null}
          <View
            {...pan.panHandlers}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("dashboard.move", { name: t(`widget.${widget.type}.name`) })}
            style={{ position: "absolute", right: 8, bottom: 8, zIndex: 4, width: 42, height: 42,
              borderRadius: 21, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "#2e2e35",
              alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="reorder-three" size={25} color={colors.lime} />
          </View>
        </View> : null}
      </Animated.View>
    </View>
  );
}

export function HomeScreen() {
  const { t, lang } = useI18n();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ edit?: string }>();
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
  const [period, setPeriod] = usePreferredPeriod();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const widgetRefs = useRef(new Map<string, View>());
  const dragFrames = useRef(new Map<string, WidgetFrame>());
  const dragGeneration = useRef(0);
  const dragIdRef = useRef<string | null>(null);
  const targetRef = useRef<string | null>(null);
  const lastPointerRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const scrollAtDragStartRef = useRef(0);
  const dragScrollCompensation = useRef(new Animated.Value(0)).current;
  const scrollHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const viewportRef = useRef({ top: 0, height: 0 });
  const autoScrollDirectionRef = useRef(0);
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const widgetsRef = useRef(layout.widgets);
  const saveRef = useRef(save);
  widgetsRef.current = layout.widgets;
  saveRef.current = save;
  const [recentSlide, setRecentSlide] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [loadMode, setLoadMode] = useState<"working" | "all">("working");
  const [specificLoadKg, setSpecificLoadKg] = useState<number | null>(null);
  const [chartInfoOpen, setChartInfoOpen] = useState(false);
  const [chartExpandedOpen, setChartExpandedOpen] = useState(false);
  const [chartPointIndex, setChartPointIndex] = useState<number | null>(null);
  const [showChartTrend, setShowChartTrend] = useState(true);
  const [showChartAverage, setShowChartAverage] = useState(false);
  const [showChartRecords, setShowChartRecords] = useState(true);
  const [showChartSmoothing, setShowChartSmoothing] = useState(false);

  useEffect(() => {
    setSelectedExerciseOverride(undefined);
    setMetricOverride(null);
    setExercisePickerOpen(false);
    setCustomizeOpen(false);
    setEditing(false);
  }, [user?.id]);

  useEffect(() => {
    if (!draft.startedAt) return;
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [draft.startedAt]);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (user?.id) void profile.refetch();
    void AsyncStorage.getItem("deepgym-chart-load").then((stored) => {
      if (active && (stored === "working" || stored === "all")) setLoadMode(stored);
    }).catch(() => {});
    return () => { active = false; };
  }, [user?.id, profile.refetch]));

  function chooseLoadMode(next: "working" | "all") {
    setLoadMode(next);
    void AsyncStorage.setItem("deepgym-chart-load", next).catch(() => {});
  }

  useEffect(() => {
    if (params.edit !== "1") return;
    setEditing(true);
    router.setParams({ edit: "" });
  }, [params.edit]);

  const mountWidget = useCallback((id: string, node: View | null) => {
    if (node) widgetRefs.current.set(id, node);
    else widgetRefs.current.delete(id);
  }, []);

  const stopAutoScroll = useCallback(() => {
    autoScrollDirectionRef.current = 0;
    if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
    autoScrollTimerRef.current = null;
  }, []);

  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  const startWidgetDrag = useCallback((id: string) => {
    const generation = ++dragGeneration.current;
    dragIdRef.current = id;
    scrollAtDragStartRef.current = scrollOffsetRef.current;
    dragScrollCompensation.setValue(0);
    dragFrames.current.clear();
    targetRef.current = null;
    lastPointerRef.current = null;
    setDropTargetId(null);
    setActiveDragId(id);
    scrollRef.current?.getNativeScrollRef()?.measureInWindow((_, top, __, height) => {
      viewportRef.current = { top, height };
    });
    for (const [widgetId, node] of widgetRefs.current) {
      node.measureInWindow((x, y, width, height) => {
        if (generation === dragGeneration.current && width > 0 && height > 0) {
          dragFrames.current.set(widgetId, { x, y, width, height });
        }
      });
    }
  }, []);

  const moveWidgetDrag = useCallback((id: string, x: number, y: number) => {
    lastPointerRef.current = { id, x, y };
    const target = dropTargetAt(dragFrames.current, id, x, y);
    if (targetRef.current !== target) {
      targetRef.current = target;
      setDropTargetId(target);
    }
    const { top, height } = viewportRef.current;
    const maxScroll = Math.max(0, contentHeightRef.current - scrollHeightRef.current);
    const direction = height > 0 && y < top + 76 && scrollOffsetRef.current > 0 ? -1
      : height > 0 && y > top + height - 84 && scrollOffsetRef.current < maxScroll ? 1 : 0;
    autoScrollDirectionRef.current = direction;
    if (direction !== 0 && !autoScrollTimerRef.current) {
      autoScrollTimerRef.current = setInterval(() => {
        const max = Math.max(0, contentHeightRef.current - scrollHeightRef.current);
        const next = Math.max(0, Math.min(max, scrollOffsetRef.current + autoScrollDirectionRef.current * 12));
        if (next !== scrollOffsetRef.current) scrollRef.current?.scrollTo({ y: next, animated: false });
      }, 16);
    } else if (direction === 0 && autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }, []);

  const endWidgetDrag = useCallback((id: string, x: number, y: number, didMove: boolean) => {
    const target = didMove ? dropTargetAt(dragFrames.current, id, x, y) ?? targetRef.current : null;
    stopAutoScroll();
    dragIdRef.current = null;
    dragScrollCompensation.setValue(0);
    lastPointerRef.current = null;
    ++dragGeneration.current;
    dragFrames.current.clear();
    targetRef.current = null;
    setDropTargetId(null);
    setActiveDragId(null);
    if (!target || target === id) return;
    const current = widgetsRef.current;
    const from = current.findIndex((widget) => widget.id === id);
    const to = current.findIndex((widget) => widget.id === target);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    saveRef.current({ version: 1, widgets: next });
  }, [stopAutoScroll]);

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

  function resizeWidget(id: string, size: WidgetSize) {
    const widget = layout.widgets.find((item) => item.id === id);
    if (!widget || widget.size === size || !WIDGETS[widget.type].sizes.includes(size)) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    commit(layout.widgets.map((item) => item.id === id ? { ...item, size } : item));
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
  const recentCardWidth = Math.max(230, Math.round((windowWidth - spacing.lg * 2) * (history.length > 1 ? 0.88 : 1)));
  const draftMinutes = draft.startedAt ? Math.max(0, Math.floor((clock - new Date(draft.startedAt).getTime()) / 60_000)) : null;
  const draftElapsed = draftMinutes == null ? "" : draftMinutes < 60
    ? t("draft.minutes", { m: draftMinutes })
    : draftMinutes < 1440
      ? t("draft.hours", { h: Math.floor(draftMinutes / 60), m: String(draftMinutes % 60).padStart(2, "0") })
      : t("draft.days", { d: Math.floor(draftMinutes / 1440) });

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
  useEffect(() => { setSpecificLoadKg(null); }, [selected?.id]);
  const allowedMetrics = selected?.bodyweight ? BODYWEIGHT_METRICS : EXTERNAL_METRICS;
  const activeMetric = allowedMetrics.includes(metric) ? metric : allowedMetrics[0];
  const exerciseUnit = selected?.unit ?? profile.data?.unit ?? "kg";
  const exerciseRecords = useMemo(() => selected ? exerciseHistory(history, selected.id) : [], [history, selected?.id]);
  const exerciseLoads = useMemo(() => loadOptions(exerciseRecords), [exerciseRecords]);
  const activeLoadFilter: LoadFilter = selected?.bodyweight || chartWidget?.size === "m" ? { mode: "all" } : specificLoadKg != null
    ? { mode: "weight", weightKg: specificLoadKg }
    : { mode: loadMode };
  const exercisePoints = useMemo(() => {
    if (!selected) return [];
    const since = lookbackStart(chartWidget?.size === "m" ? "3m" : period, today);
    const records = filterByLoad(exerciseRecords, activeLoadFilter);
    return exerciseProgress(records, activeMetric)
      .filter((point) => !since || point.date >= since)
      .map((point) => ({
        ...point,
        displayValue: activeMetric === "reps" ? point.value : kgToUnit(point.value, exerciseUnit),
      }));
  }, [exerciseRecords, selected?.id, selected?.bodyweight, activeMetric, period, exerciseUnit, todayISO, loadMode, specificLoadKg, chartWidget?.size]);
  const latestPoint = exercisePoints[exercisePoints.length - 1];
  const oldestPoint = exercisePoints[0];
  const shownPoint = chartPointIndex == null ? latestPoint : exercisePoints[chartPointIndex] ?? latestPoint;
  useEffect(() => { setChartPointIndex(null); }, [selected?.id, activeMetric, period, loadMode, specificLoadKg, chartWidget?.size]);
  const metricValue = (value: number) => activeMetric === "reps"
    ? String(Math.round(value))
    : activeMetric === "volume"
      ? Math.round(value).toLocaleString(lang)
      : `${activeMetric === "addedLoad" && value > 0 ? "+" : ""}${roundWeight(value)}`;
  const metricDelta = (value: number) => `${value > 0 ? "+" : ""}${activeMetric === "reps" ? Math.round(value) : activeMetric === "volume" ? Math.round(value).toLocaleString(lang) : roundWeight(value)}`;
  const chartMarkers = new Set<number>();
  let chartBest = -Infinity;
  exercisePoints.forEach((point, index) => {
    if (index > 0 && point.value > chartBest + 1e-9) chartMarkers.add(index);
    chartBest = Math.max(chartBest, point.value);
  });
  const chartValues = exercisePoints.map((point) => point.displayValue);
  const chartDates = exercisePoints.map((point) => point.date);
  const chartSummary = (() => {
    if (!exercisePoints.length) return null;
    const first = exercisePoints[0];
    const last = exercisePoints[exercisePoints.length - 1];
    const best = Math.max(...chartValues);
    const average = chartValues.reduce((sum, value) => sum + value, 0) / chartValues.length;
    const dates = exercisePoints.map((point) => Date.parse(`${point.date}T12:00:00`) / 86_400_000);
    const meanDate = dates.reduce((sum, date) => sum + date, 0) / dates.length;
    const slopeNumerator = dates.reduce((sum, date, index) => sum + (date - meanDate) * (chartValues[index] - average), 0);
    const slopeDenominator = dates.reduce((sum, date) => sum + (date - meanDate) ** 2, 0);
    const trend = slopeDenominator > 0 ? slopeNumerator / slopeDenominator * 30 : null;
    const change = first.displayValue ? Math.round((last.displayValue - first.displayValue) / Math.abs(first.displayValue) * 100) : 0;
    return [
      { label: t("stats.best"), value: metricValue(best), suffix: activeMetric === "reps" ? undefined : exerciseUnit },
      { label: t("stats.average"), value: metricValue(average), suffix: activeMetric === "reps" ? undefined : exerciseUnit },
      { label: t("stats.trend"), value: trend == null ? "—" : metricDelta(trend), suffix: trend == null ? undefined : `${activeMetric === "reps" ? "" : exerciseUnit}${t("stats.perMonthUnit")}` },
      { label: t("detail.sessions"), value: String(exercisePoints.length), suffix: undefined },
      { label: t("stats.records"), value: String(chartMarkers.size), suffix: undefined },
      { label: t("stats.change"), value: `${change > 0 ? "+" : ""}${change}%`, suffix: undefined },
    ];
  })();

  const weightRows = bodyWeight.data ?? [];
  const currentWeight = profile.data?.body_weight_kg ?? weightRows[0]?.weight_kg ?? null;
  const oldestWeight = weightRows[weightRows.length - 1]?.weight_kg;
  const weightChange = currentWeight != null && oldestWeight != null && weightRows.length > 1
    ? roundWeight(kgToUnit(currentWeight - oldestWeight, profile.data?.unit ?? "kg"))
    : null;

  function renderWidget(type: MobileWidgetType, size: WidgetSize): ReactNode {
    const currentProfile = profile.data;
    if (!currentProfile) return null;

    switch (type) {
      case "startWorkout":
        return (
          <Pressable onPress={() => router.push("/new")} accessibilityRole="button">
            {hasDraft ? (
              <Card variant="live" style={{ minHeight: size === "s" ? 145 : 164 }}>
                <View style={{ flex: 1, justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime,
                      shadowColor: colors.lime, shadowOpacity: 0.5, shadowRadius: 6 }} />
                    <Text variant="micro" tone="lime" weight="bold" style={{ letterSpacing: 1.4 }}>
                      {t("draft.inProgress")}{draftElapsed ? ` · ${draftElapsed}` : ""}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: size === "s" ? 22 : 34 }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="title">{draft.type}</Text>
                      <Text variant="caption" tone="muted" style={{ marginTop: 3 }}>
                        {translateCount(lang, "count.exercises", draft.exercises.length)}{size === "s" ? "" : ` · ${translateCount(lang, "count.sets", filledSets)}`}
                      </Text>
                    </View>
                    {size === "s" ? null : <View style={{ minHeight: 40, borderRadius: 20, backgroundColor: colors.lime, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Text style={{ color: colors.black }} weight="semibold">{t("draft.continueShort")}</Text>
                      <Ionicons name="chevron-forward" size={15} color={colors.black} />
                    </View>}
                  </View>
                </View>
              </Card>
            ) : (
              <GradientCard variant="pink" style={{ minHeight: size === "s" ? 145 : 136 }}>
                <View style={{ flex: 1, flexDirection: size === "s" ? "column-reverse" : "row", alignItems: size === "s" ? "flex-start" : "flex-end", justifyContent: "space-between", gap: 10 }}>
                  <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <Text variant="title">{t("home.startWorkout")}</Text>
                    {size === "m" ? <Text variant="caption" tone="muted">{t("home.logSession")}</Text> : null}
                  </View>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}><HomeTileIcon name="plus" size={24} color={colors.white} /></View>
                </View>
              </GradientCard>
            )}
          </Pressable>
        );

      case "weekActivity":
        return (
          <Pressable style={{ flex: 1 }} onPress={() => router.push("/history")} accessibilityRole="button">
            <StatCard label={t("home.workoutsThisWeek")} value={weekCount}
              suffix={size === "m" && schedule.some(Boolean) ? `/${schedule.filter(Boolean).length}` : undefined}
              icon="dumbbell" footer={<WeekBars workouts={history} schedule={schedule} today={today} expanded={size === "m"} />} />
          </Pressable>
        );

      case "streak":
        return (
          <Pressable style={{ flex: 1 }} onPress={() => router.push("/history")} accessibilityRole="button">
            <StatCard label={t("home.weekStreak")} value={weekStreak(history, today)} suffix={t("home.wk")} icon="flame" indigo />
          </Pressable>
        );

      case "nextWorkout":
        return next ? <ScheduledWorkoutCard prediction={next} /> : (
          <Pressable onPress={() => router.push({ pathname: "/settings", params: { open: "schedule" } })} accessibilityRole="button">
            <GradientCard variant="cherry" style={{ minHeight: 162 }}>
              <View style={{ flex: 1, justifyContent: "flex-end" }}>
                <Text variant="title">{t("widget.nextWorkout.planTitle")} ›</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>{t("widget.nextWorkout.planHint")}</Text>
              </View>
            </GradientCard>
          </Pressable>
        );

      case "recentWorkouts":
        return (
          <Card variant="stat" padding={16} radius={22} style={{ flex: 1, minHeight: size === "m" ? 184 : 310 }}>
            <HomeTileHead label={translateCount(lang, "count.lastWorkouts", Math.max(1, Math.min(3, history.length)))}
              action={<Pressable onPress={() => router.push("/history")} accessibilityRole="link"
                style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Text variant="caption" tone="muted">{t("home.allHistory")}</Text>
                <HomeTileIcon name="chevron" size={14} color={colors.muted} />
              </Pressable>} />
            {!history.length ? <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: 6 }}>
              <Text weight="semibold">{t("home.emptyTitle")}</Text>
              <Text variant="caption" tone="muted">{t("home.emptyHint")}</Text>
            </View> : size === "m" ? <View style={{ flex: 1, marginTop: 11 }}>
              {history.slice(0, 3).map((workout, index) => <Pressable key={workout.id}
                onPress={() => router.push({ pathname: "/workouts/[id]/edit", params: { id: workout.id } })}
                accessibilityRole="link" style={{ flex: 1, minHeight: 47, flexDirection: "row", alignItems: "center",
                  borderTopWidth: index === 0 ? 0 : 1, borderTopColor: "rgba(42,42,49,0.6)" }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="semibold" numberOfLines={1} style={{ fontSize: 14 }}>{workout.type}</Text>
                  <Text variant="caption" tone="faint" numberOfLines={1} style={{ fontSize: 11 }}>
                    {formatDate(workout.date, lang)} · {translateCount(lang, "count.exercises", workout.workout_exercises.length)}
                  </Text>
                </View>
                <DotValue value={workoutSetCount(workout)} suffix={t("widget.setsShort")} size={19} />
              </Pressable>)}
            </View> : <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}
                contentContainerStyle={{ gap: 10, paddingRight: 20 }} snapToInterval={recentCardWidth + 10}
                decelerationRate="fast" onMomentumScrollEnd={(event) => setRecentSlide(Math.min(2, Math.round(event.nativeEvent.contentOffset.x / (recentCardWidth + 10))))}>
                {history.slice(0, 3).map((workout) => <View key={workout.id} style={{ width: recentCardWidth }}>
                  <WorkoutCard workout={workout} unit={currentProfile.unit}
                    onPress={() => router.push({ pathname: "/workouts/[id]/edit", params: { id: workout.id } })} />
                </View>)}
              </ScrollView>
              {history.length > 1 ? <View style={{ flexDirection: "row", alignSelf: "center", gap: 6, marginTop: 10 }}>
                {history.slice(0, 3).map((workout, index) => <View key={workout.id} style={{ width: recentSlide === index ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: recentSlide === index ? colors.lime : colors.line }} />)}
              </View> : null}
            </>}
          </Card>
        );

      case "exerciseProgress":
        if (size === "m") return <Card variant="stat" radius={22} padding={16} style={{ minHeight: 148 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable onPress={() => setExercisePickerOpen(true)} disabled={!selected}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 5 }} accessibilityRole="button">
              <Text weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>{selected?.name ?? t("home.progress")}</Text>
              {selected ? <Ionicons name="chevron-down" size={14} color={colors.muted} /> : null}
            </Pressable>
            {selected ? <Pressable onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: selected.id } })}
              style={{ flexDirection: "row", alignItems: "center" }} accessibilityRole="link">
              <Text variant="caption" tone="muted">{t("home.details")}</Text>
              <HomeTileIcon name="chevron" size={14} color={colors.muted} />
            </Pressable> : null}
          </View>
          {shownPoint ? <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 15, marginTop: 16 }}>
            <View>
              <Text variant="micro" tone="muted">{t(`stats.metric.${activeMetric}`)}</Text>
              <DotValue value={metricValue(shownPoint.displayValue)} suffix={activeMetric === "reps" ? undefined : exerciseUnit} size={25} />
              {oldestPoint && exercisePoints.length > 1 ? <Text variant="caption"
                tone={shownPoint.displayValue >= oldestPoint.displayValue ? "lime" : "pink"} style={{ fontSize: 11 }}>
                {metricDelta(shownPoint.displayValue - oldestPoint.displayValue)} <Text tone="faint">{t("period.over.3m")}</Text>
              </Text> : null}
            </View>
            <View style={{ flex: 1, minWidth: 70 }}><Sparkline values={exercisePoints.map((point) => point.displayValue)} color={colors.white} height={64} /></View>
          </View> : <Text variant="caption" tone="muted" style={{ marginTop: 18 }}>{t("stats.emptyPeriod")}</Text>}
        </Card>;
        return (
          <Card variant="stat" radius={22} padding={16}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable onPress={() => setExercisePickerOpen(true)} disabled={!selected} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 5 }} accessibilityRole="button">
                <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>{selected?.name ?? t("home.progress")}</Text>
                {selected ? <Ionicons name="chevron-down" size={15} color={colors.muted} /> : null}
              </Pressable>
              {selected ? <Pressable onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: selected.id } })} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center" }}>
                <Text variant="caption" tone="muted">{t("home.details")}</Text><Ionicons name="chevron-forward" size={14} color={colors.muted} />
              </Pressable> : null}
            </View>
            {selected && size === "l" ? <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 15 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5 }} style={{ flex: 1 }}>
                  {allowedMetrics.map((option) => <Pressable key={option} onPress={() => { setMetricOverride(option); patchChartConfig({ metric: option }); }} accessibilityRole="button" accessibilityState={{ selected: activeMetric === option }} style={{ minHeight: 29, paddingHorizontal: 12, borderRadius: 15, justifyContent: "center", backgroundColor: activeMetric === option ? colors.white : colors.raised }}>
                    <Text weight="medium" style={{ color: activeMetric === option ? colors.black : colors.muted, fontSize: 12 }}>{t(`stats.metric.${option}`)}</Text>
                  </Pressable>)}
                </ScrollView>
                <Pressable onPress={() => setChartInfoOpen(true)} accessibilityRole="button" accessibilityLabel={t("stats.info.title")} style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}><Ionicons name="information-circle-outline" size={20} color={colors.muted} /></Pressable>
                <Pressable onPress={() => setChartExpandedOpen(true)} accessibilityRole="button" accessibilityLabel={t("stats.fullscreen")} style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}><Ionicons name="expand-outline" size={20} color={colors.muted} /></Pressable>
              </View>
              {!selected.bodyweight ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, paddingVertical: 12 }}>
                {([{ key: "working", label: t("stats.filter.working"), mode: "working" as const, value: null }, { key: "all", label: t("stats.filter.all"), mode: "all" as const, value: null }, ...exerciseLoads.map((value) => ({ key: String(value), label: `${roundWeight(kgToUnit(value, exerciseUnit))} ${exerciseUnit}`, mode: "weight" as const, value }))]).map((option) => {
                  const active = option.mode === "weight" ? specificLoadKg === option.value : specificLoadKg == null && loadMode === option.mode;
                  return <Pressable key={option.key} onPress={() => { if (option.mode === "weight") { setSpecificLoadKg(option.value); if (activeMetric === "topSet") { setMetricOverride("reps"); patchChartConfig({ metric: "reps" }); } } else { setSpecificLoadKg(null); chooseLoadMode(option.mode); } }} accessibilityRole="button" accessibilityState={{ selected: active }} style={{ minHeight: 27, borderRadius: 14, borderWidth: 1, borderStyle: active ? "solid" : "dashed", borderColor: active ? "rgba(215,246,81,0.45)" : colors.line, backgroundColor: active ? "rgba(215,246,81,0.1)" : "transparent", paddingHorizontal: 10, justifyContent: "center" }}>
                    <Text weight="medium" style={{ fontSize: 11, color: active ? colors.lime : colors.faint }}>{option.label}</Text>
                  </Pressable>;
                })}
              </ScrollView> : null}
              <Text variant="caption" tone="faint" style={{ marginTop: selected.bodyweight ? 12 : 0 }}>{t(`stats.caption.${activeMetric}`)}{selected.bodyweight ? "" : ` · ${specificLoadKg != null ? t("stats.filter.weightHint", { weight: `${roundWeight(kgToUnit(specificLoadKg, exerciseUnit))} ${exerciseUnit}` }) : t(`stats.filter.${loadMode}Hint`)}`}</Text>
            </> : null}
            {selected && shownPoint ? <>
              <View style={{ flexDirection: size === "l" ? "column" : "row", justifyContent: "space-between", alignItems: size === "l" ? "flex-start" : "flex-end", marginTop: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                  <DotValue value={metricValue(shownPoint.displayValue)} suffix={activeMetric === "reps" ? undefined : exerciseUnit} size={size === "l" ? 36 : 27} color={colors.lime} />
                  <Text variant="caption" tone="muted" style={{ paddingBottom: 4 }}>{chartPointIndex == null ? `${t("stats.latest")} · ` : ""}{new Date(`${shownPoint.date}T12:00:00`).toLocaleDateString(lang, { month: "short", day: "numeric" })}</Text>
                </View>
                {oldestPoint && exercisePoints.length > 1 && (chartPointIndex == null || chartPointIndex > 0) ? <Text variant="caption" tone={shownPoint.displayValue >= oldestPoint.displayValue ? "lime" : "pink"} style={{ marginTop: size === "l" ? 3 : 0 }}>
                  {metricDelta(shownPoint.displayValue - oldestPoint.displayValue)} {activeMetric === "reps" ? "" : exerciseUnit} · {t("stats.vsStart")}
                </Text> : null}
              </View>
              <View style={{ marginTop: 12 }}><ProgressTrendLine values={chartValues} dates={chartDates} locale={lang} markers={chartMarkers} color={colors.white} framed chartId="homeExerciseTrend" height={176} activeIndex={chartPointIndex} onActiveChange={setChartPointIndex} /></View>
              <ChartPeriodSwitch value={period} onChange={(next) => { setChartPointIndex(null); setPeriod(next); }} style={{ marginTop: 13 }} />
            </> : selected ? <Text tone="muted" style={{ marginTop: 22 }}>{t("stats.emptyPeriod")}</Text> : <Text tone="muted" style={{ marginTop: 15 }}>{t("widget.exerciseProgress.empty")}</Text>}
          </Card>
        );

      case "bodyWeight":
        return (
          <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: "/settings", params: { open: "weight" } })} accessibilityRole="button">
            <Card variant="stat" padding={16} style={{ minHeight: 145, flex: 1 }}>
              <HomeTileHead label={t("bodyWeight.title")} icon="scale" tone="lime" />
              {currentWeight == null ? (
                <Text variant="caption" tone="muted" style={{ marginTop: 17 }}>{t("widget.bodyWeight.empty")}</Text>
              ) : <>
                <View style={{ flex: 1, justifyContent: "flex-end", flexDirection: size === "m" ? "row" : "column", alignItems: size === "m" ? "flex-end" : "stretch", gap: 8 }}>
                  <View style={{ flex: size === "m" ? 0 : undefined }}>
                    <DotValue value={roundWeight(kgToUnit(currentWeight, currentProfile.unit))} suffix={currentProfile.unit} size={30} />
                    {weightChange != null ? <Text variant="caption" tone="muted">
                      {weightChange > 0 ? "+" : weightChange < 0 ? "−" : ""}{Math.abs(weightChange)} {currentProfile.unit}
                    </Text> : null}
                  </View>
                  {weightRows.length > 1 ? <View style={{ flex: size === "m" ? 1 : undefined, minWidth: size === "m" ? 80 : undefined }}>
                    <Sparkline values={[...weightRows].reverse().map((row) => row.weight_kg)} height={size === "m" ? 64 : 32} />
                  </View> : null}
                </View>
              </>}
            </Card>
          </Pressable>
        );

      case "totalWorkouts":
        return (
          <Pressable style={{ flex: 1 }} onPress={() => router.push("/history")} accessibilityRole="button">
            <Card variant="stat" padding={16} style={{ minHeight: 145, flex: 1 }}>
              <HomeTileHead label={t("home.totalWorkouts")} icon="history" />
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
        return <ConsistencyHeatmap workouts={history} today={today} size={size} />;

      default:
        return <HomeExtraWidget type={type} size={size} history={history} unit={currentProfile.unit} schedule={schedule} today={today} />;
    }
  }

  return (
    <Screen bottomPadding={122} scrollRef={scrollRef} scrollEnabled={!activeDragId}
      scrollEventThrottle={16}
      onLayout={(event) => { scrollHeightRef.current = event.nativeEvent.layout.height; }}
      onContentSizeChange={(_, height) => { contentHeightRef.current = height; }}
      onScroll={(event) => {
        const next = event.nativeEvent.contentOffset.y;
        const delta = next - scrollOffsetRef.current;
        scrollOffsetRef.current = next;
        if (!dragIdRef.current || delta === 0) return;
        dragScrollCompensation.setValue(next - scrollAtDragStartRef.current);
        for (const frame of dragFrames.current.values()) frame.y -= delta;
        const pointer = lastPointerRef.current;
        if (!pointer) return;
        const target = dropTargetAt(dragFrames.current, pointer.id, pointer.x, pointer.y);
        if (targetRef.current !== target) {
          targetRef.current = target;
          setDropTargetId(target);
        }
      }}>
      <View style={{ marginTop: 8, marginBottom: 21 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 42 }}>
          <BrandMark size={24} />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            {today.toLocaleDateString(lang, { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          {profile.data ? <Pressable onPress={() => setEditing((current) => !current)} accessibilityRole="button" accessibilityLabel={editing ? t("dashboard.done") : t("dashboard.customize")}
            style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: editing ? "rgba(215,246,81,0.15)" : colors.raised }}>
            {editing ? <Ionicons name="checkmark" size={18} color={colors.lime} /> : <HomeTileIcon name="widgets" size={18} color={colors.muted} />}
          </Pressable> : null}
          <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel={t("settings.title")}
            style={{ width: 38, height: 38, borderRadius: 19, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised }}>
            <Image source={avatarSource(profile.data?.avatar_url ?? null)} style={{ width: 36, height: 36 }} />
          </Pressable>
        </View>
        <Text variant="heading" style={{ marginTop: 3 }}>
          {t("home.greeting", { name: profile.data?.display_name?.split(" ")[0] ?? t("home.athlete") })}
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
        {editing ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 25,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: colors.raised,
          padding: 5, marginBottom: 20 }}>
          <Pressable onPress={() => setCustomizeOpen(true)} accessibilityRole="button"
            style={{ minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11,
              borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)" }}>
            <Ionicons name="add" size={17} color={colors.text} />
            <Text variant="caption" weight="semibold">{t("dashboard.addWidget")}</Text>
          </Pressable>
          {isCustom ? <Pressable onPress={() => Alert.alert(
            t("dashboard.resetTitle"), t("dashboard.resetMessage"), [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("dashboard.reset"), style: "destructive", onPress: reset },
            ],
          )} accessibilityRole="button" style={{ paddingHorizontal: 5 }}>
            <Text variant="caption" tone="muted">{t("dashboard.reset")}</Text>
          </Pressable> : null}
          <Pressable onPress={() => setEditing(false)} accessibilityRole="button"
            style={{ minHeight: 36, marginLeft: "auto", paddingHorizontal: 12, borderRadius: 20,
              backgroundColor: colors.lime, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="checkmark" size={17} color={colors.black} />
            <Text variant="caption" weight="semibold" style={{ color: colors.black }}>{t("dashboard.done")}</Text>
          </Pressable>
        </View> : null}
        {history.length === 0 ? <FirstWorkoutGuide /> : null}
        {rows.length ? rows.map((row) => (
          <View key={row.map((widget) => widget.id).join(":")} style={{
            flexDirection: "row", gap: 12,
            marginBottom: row.some((widget) => widget.type === "nextWorkout" || widget.type === "recentWorkouts") ? 23 : 13,
            zIndex: row.some((widget) => widget.id === activeDragId) ? 20 : 0,
          }}>
            {row.map((widget) => (
              <DraggableWidget key={widget.id} widget={widget} editing={editing}
                dragging={widget.id === activeDragId} dropTarget={widget.id === dropTargetId}
                scrollCompensation={dragScrollCompensation}
                onMount={mountWidget} onDragStart={startWidgetDrag}
                onDragMove={moveWidgetDrag} onDragEnd={endWidgetDrag}
                onLongPress={() => setEditing(true)}
                onRemove={() => hideWidget(widget)} onResize={(size) => resizeWidget(widget.id, size)}>
                {renderWidget(widget.type, widget.size)}
              </DraggableWidget>
            ))}
          </View>
        )) : (
          <Pressable onPress={() => setCustomizeOpen(true)} accessibilityRole="button" style={{ marginBottom: 13 }}>
            <Card><Text tone="muted">{t("dashboard.empty")}</Text></Card>
          </Pressable>
        )}

        {!editing ? <Button variant="ghost" block onPress={() => setEditing(true)} style={{ marginTop: 7, marginBottom: 18 }}>
          {t("dashboard.customize")}
        </Button> : null}

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
        <Modal visible={chartExpandedOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => chartInfoOpen ? setChartInfoOpen(false) : setChartExpandedOpen(false)}>
          <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="semibold" numberOfLines={1} style={{ fontSize: 20 }}>{selected?.name ?? t("home.progress")}</Text>
                <Text tone="muted" style={{ fontSize: 13, marginTop: 2 }}>{t("home.progress")}</Text>
              </View>
              <Pressable onPress={() => setChartInfoOpen(true)} accessibilityRole="button" accessibilityLabel={t("stats.info.title")} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}><Ionicons name="information-circle-outline" size={20} color={colors.muted} /></Pressable>
              <Pressable onPress={() => { setChartInfoOpen(false); setChartExpandedOpen(false); }} accessibilityRole="button" accessibilityLabel={t("common.close")} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}><Ionicons name="close" size={23} color={colors.muted} /></Pressable>
            </View>
            {selected ? <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 24) + 24 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
                {allowedMetrics.map((option) => <Pressable key={option} onPress={() => { setMetricOverride(option); patchChartConfig({ metric: option }); setChartPointIndex(null); }} accessibilityRole="button" accessibilityState={{ selected: activeMetric === option }} style={{ minHeight: 32, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: activeMetric === option ? colors.white : "rgba(255,255,255,0.05)", backgroundColor: activeMetric === option ? colors.white : "rgba(255,255,255,0.035)" }}><Text weight="medium" style={{ fontSize: 12, color: activeMetric === option ? colors.black : colors.muted }}>{t(`stats.metric.${option}`)}</Text></Pressable>)}
              </ScrollView>
              {!selected.bodyweight ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, paddingBottom: 9 }}>
                {([{ key: "working", label: t("stats.filter.working"), mode: "working" as const, value: null }, { key: "all", label: t("stats.filter.all"), mode: "all" as const, value: null }, ...exerciseLoads.map((value) => ({ key: String(value), label: `${roundWeight(kgToUnit(value, exerciseUnit))} ${exerciseUnit}`, mode: "weight" as const, value }))]).map((option) => {
                  const active = option.mode === "weight" ? specificLoadKg === option.value : specificLoadKg == null && loadMode === option.mode;
                  return <Pressable key={option.key} onPress={() => { setChartPointIndex(null); if (option.mode === "weight") { setSpecificLoadKg(option.value); if (activeMetric === "topSet") { setMetricOverride("reps"); patchChartConfig({ metric: "reps" }); } } else { setSpecificLoadKg(null); chooseLoadMode(option.mode); } }} accessibilityRole="button" accessibilityState={{ selected: active }} style={{ minHeight: 27, borderRadius: 14, borderWidth: 1, borderStyle: active ? "solid" : "dashed", borderColor: active ? "rgba(215,246,81,0.45)" : colors.line, backgroundColor: active ? "rgba(215,246,81,0.1)" : "transparent", paddingHorizontal: 10, justifyContent: "center" }}><Text weight="medium" style={{ fontSize: 11, color: active ? colors.lime : colors.faint }}>{option.label}</Text></Pressable>;
                })}
              </ScrollView> : null}
              <Text variant="caption" tone="faint" style={{ fontSize: 12, lineHeight: 17, marginTop: 2, marginBottom: 16 }}>{t(`stats.caption.${activeMetric}`)}{selected.bodyweight ? "" : ` · ${specificLoadKg != null ? t("stats.filter.weightHint", { weight: `${roundWeight(kgToUnit(specificLoadKg, exerciseUnit))} ${exerciseUnit}` }) : t(`stats.filter.${loadMode}Hint`)}`}</Text>
              {shownPoint ? <View style={{ minHeight: 59, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, paddingHorizontal: 2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <DotValue value={metricValue(shownPoint.displayValue)} suffix={activeMetric === "reps" ? undefined : exerciseUnit} size={35} />
                  <Text variant="caption" tone="muted" style={{ fontSize: 11, marginTop: 3 }}>{chartPointIndex == null ? `${t("stats.latest")} · ` : ""}{new Date(`${shownPoint.date}T12:00:00`).toLocaleDateString(lang, { weekday: "short", month: "short", day: "numeric" })}{chartPointIndex != null ? ` · ${translateCount(lang, "count.sets", shownPoint.sets)}` : ""}</Text>
                </View>
                {oldestPoint && exercisePoints.length > 1 && (chartPointIndex == null || chartPointIndex > 0) ? <View style={{ alignItems: "flex-end", paddingBottom: 2 }}>
                  <DotValue value={metricDelta(shownPoint.displayValue - oldestPoint.displayValue)} suffix={activeMetric === "reps" ? undefined : exerciseUnit} size={17} color={shownPoint.displayValue >= oldestPoint.displayValue ? colors.lime : colors.flame} />
                  <Text variant="micro" tone="faint" style={{ fontSize: 9.5, marginTop: 3 }}>{t("stats.vsStart")}</Text>
                </View> : null}
              </View> : <Text tone="muted" style={{ paddingVertical: 28, textAlign: "center" }}>{t("stats.emptyPeriod")}</Text>}
              {exercisePoints.length ? <View style={{ marginTop: 18 }}><ProgressTrendLine values={chartValues} dates={chartDates} locale={lang} markers={chartMarkers} color={colors.white} framed chartId="homeExpandedTrend" height={Math.round(Math.min(Math.max(windowHeight * 0.42, 220), 420))} showTrend={showChartTrend} showAverage={showChartAverage} showRecords={showChartRecords} showSmoothing={showChartSmoothing} activeIndex={chartPointIndex} onActiveChange={setChartPointIndex} /></View> : null}
              <ChartPeriodSwitch value={period} onChange={(next) => { setChartPointIndex(null); setPeriod(next); }} style={{ marginTop: 14, marginBottom: 14 }} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {([
                  { label: t("stats.tool.trend"), on: showChartTrend, toggle: () => setShowChartTrend((value) => !value), color: "#8c9bff", ring: false, solid: false },
                  { label: t("stats.tool.average"), on: showChartAverage, toggle: () => setShowChartAverage((value) => !value), color: colors.lime, ring: false, solid: false },
                  { label: t("stats.tool.records"), on: showChartRecords, toggle: () => setShowChartRecords((value) => !value), color: colors.lime, ring: true, solid: false },
                  { label: t("stats.tool.smoothing"), on: showChartSmoothing, toggle: () => setShowChartSmoothing((value) => !value), color: "#f567b5", ring: false, solid: true },
                ]).map((tool) => <Pressable key={tool.label} onPress={tool.toggle} accessibilityRole="button" accessibilityState={{ selected: tool.on }} style={{ height: 32, borderRadius: 16, borderWidth: 1, borderColor: tool.on ? "rgba(255,255,255,0.14)" : colors.line, backgroundColor: tool.on ? colors.raised : "transparent", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <View style={tool.ring ? { width: 10, height: 10, borderRadius: 5, borderWidth: 1.8, borderColor: tool.color } : { width: 14, borderTopWidth: 2, borderTopColor: tool.color, borderStyle: tool.solid ? "solid" : "dashed" }} />
                  <Text style={{ fontSize: 12, color: tool.on ? colors.text : colors.faint }}>{tool.label}</Text>
                </Pressable>)}
              </View>
              {chartSummary ? <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6, marginTop: 18 }}>
                {chartSummary.map((stat) => <View key={stat.label} style={{ width: "32%", minWidth: 0, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.035)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.045)", paddingHorizontal: 10, paddingVertical: 8 }}>
                  <Text variant="micro" tone="muted" numberOfLines={1} style={{ fontSize: 9.5, lineHeight: 13, marginBottom: 2 }}>{stat.label}</Text>
                  <DotValue value={stat.value} suffix={stat.suffix} size={17} />
                </View>)}
              </View> : null}
              {exercisePoints.length ? <View style={{ marginTop: 20 }}>
                <Text weight="semibold" style={{ fontSize: 15, marginBottom: 10 }}>{t("stats.sessionsList")}</Text>
                <View style={{ borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
                  {exercisePoints.map((point, index) => ({ point, index })).reverse().map(({ point, index }, rowIndex) => <Pressable key={point.date} onPress={() => setChartPointIndex(chartPointIndex === index ? null : index)} accessibilityRole="button" accessibilityState={{ selected: chartPointIndex === index }} style={{ minHeight: 66, borderTopWidth: rowIndex ? 1 : 0, borderTopColor: colors.line, backgroundColor: chartPointIndex === index ? "rgba(215,246,81,0.08)" : "transparent", paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ flex: 1, minWidth: 0 }}><Text weight="medium" style={{ fontSize: 13 }}>{new Date(`${point.date}T12:00:00`).toLocaleDateString(lang, { weekday: "short", month: "short", day: "numeric" })}</Text><Text variant="caption" tone="muted" style={{ fontSize: 11, marginTop: 3 }}>{translateCount(lang, "count.sets", point.sets)}</Text></View>
                    {chartMarkers.has(index) ? <View style={{ flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 9, backgroundColor: "rgba(215,246,81,0.13)", paddingHorizontal: 5, paddingVertical: 3 }}><HomeTileIcon name="trophy" size={10} color={colors.lime} /><Text style={{ color: colors.lime, fontSize: 9 }}>{t("stats.pr")}</Text></View> : null}
                    <DotValue value={metricValue(point.displayValue)} suffix={activeMetric === "reps" ? undefined : exerciseUnit} size={18} />
                  </Pressable>)}
                </View>
              </View> : null}
            </ScrollView> : null}
            {chartInfoOpen ? <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "flex-end", zIndex: 10 }}>
              <Pressable onPress={() => setChartInfoOpen(false)} accessibilityRole="button" accessibilityLabel={t("common.close")} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.7)" }} />
              <View style={{ maxHeight: windowHeight * 0.88, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 20) }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: 15 }} />
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                  <Text variant="title" style={{ flex: 1 }}>{t("stats.info.title")}</Text>
                  <Pressable onPress={() => setChartInfoOpen(false)} accessibilityRole="button" accessibilityLabel={t("common.close")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={23} color={colors.muted} /></Pressable>
                </View>
                <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}><MetricInfoContent metrics={allowedMetrics} active={activeMetric} /></ScrollView>
              </View>
            </View> : null}
          </View>
        </Modal>
        <MetricInfoSheet open={chartInfoOpen && !chartExpandedOpen} onClose={() => setChartInfoOpen(false)} metrics={allowedMetrics} active={activeMetric} />
      </> : null}
    </Screen>
  );
}
