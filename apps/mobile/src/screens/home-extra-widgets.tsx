import { router } from "expo-router";
import { Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { bestLifts, percentChange, periodTotals, personalRecords, setsByMuscleGroup, weeklyBuckets } from "@deepgym/core/analytics";
import { translateCount } from "@deepgym/core/i18n";
import { formatWeeklyActivityAxis, formatWeeklyActivityRange, formatWeeklyActivityValue, weeklyActivityValue } from "@deepgym/core/weekly-activity";
import type { Workout } from "@deepgym/core/types";
import type { WidgetSize, WidgetType } from "@deepgym/core/home-layout";
import { kgToUnit, roundWeight, type Unit } from "@deepgym/core/weight";
import { useMuscleGroups, useTemplates } from "../data/queries";
import { useI18n } from "../providers/locale-provider";
import { colors } from "../theme";
import { Card, DotValue, Text } from "../ui";
import { formatDate, localISO } from "./format";
import { lookbackStart } from "./period-range";
import { HomeTileHead, HomeTileIcon } from "./home-tile-icons";

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${Math.round(value / 10_000) / 100}M`;
  if (abs >= 10_000) return `${Math.round(value / 100) / 10}k`;
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function percent(current: number, previous: number): string | null {
  const value = percentChange(current, previous);
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return `${rounded > 0 ? "▲" : rounded < 0 ? "▼" : "•"} ${Math.abs(rounded)}%`;
}

function shortDate(date: string, locale: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function WeeklyVolumeBars({ history, unit, lang, today }: { history: Workout[]; unit: Unit; lang: "en" | "ru" | "uk"; today: Date }) {
  const buckets = weeklyBuckets(history, 8, today);
  const max = Math.max(1, ...buckets.map((bucket) => weeklyActivityValue(bucket, "volumeKg")));
  const current = buckets[buckets.length - 1];
  return <View accessibilityLabel={`${formatWeeklyActivityValue(current, "volumeKg", unit, lang)}, ${formatWeeklyActivityRange(current.start, lang)}`}>
    <Text variant="caption" tone="faint" numberOfLines={1} style={{ fontSize: 9, lineHeight: 12, textAlign: "right" }}>
      {formatWeeklyActivityRange(current.start, lang)}
    </Text>
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 59, gap: 3 }}>
      {buckets.map((bucket, index) => {
        const value = weeklyActivityValue(bucket, "volumeKg");
        return <View key={bucket.start} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: 59 }}>
          <View style={{ width: "100%", maxWidth: 16, height: Math.max(value > 0 ? 4 : 2, value / max * 56),
            borderRadius: 4, backgroundColor: index === buckets.length - 1 ? colors.lime : value > 0 ? "#55555b" : colors.line }} />
        </View>;
      })}
    </View>
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
      <Text variant="caption" tone="faint" style={{ fontSize: 9, lineHeight: 11 }}>{formatWeeklyActivityAxis(buckets[0].start, lang)}</Text>
      <Text variant="caption" tone="faint" style={{ fontSize: 9, lineHeight: 11 }}>{formatWeeklyActivityAxis(current.start, lang)}</Text>
    </View>
  </View>;
}

export function HomeExtraWidget({ type, size, history, unit, schedule, today }: {
  type: WidgetType;
  size: WidgetSize;
  history: Workout[];
  unit: Unit;
  schedule: (string | null)[];
  today: Date;
}) {
  const { t, lang } = useI18n();
  const templates = useTemplates();
  const groups = useMuscleGroups();
  const [previousWeek, week] = weeklyBuckets(history, 2, today);
  const monthFrom = localISO(new Date(today.getFullYear(), today.getMonth(), 1));
  const prevMonthFrom = localISO(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const prevMonthEnd = localISO(new Date(today.getFullYear(), today.getMonth() - 1,
    Math.min(today.getDate(), new Date(today.getFullYear(), today.getMonth(), 0).getDate())));

  if (type === "templates") return <Card variant="stat" padding={16} radius={22} style={{ minHeight: size === "l" ? 315 : 180 }}>
    <HomeTileHead label={t("templates.title")} action={<Pressable onPress={() => router.push({ pathname: "/library", params: { tab: "templates" } })}
      style={{ flexDirection: "row", alignItems: "center" }}><Text variant="caption" tone="muted">{t("widget.all")}</Text>
      <HomeTileIcon name="chevron" size={14} color={colors.muted} /></Pressable>} />
    <View style={{ flex: 1, marginTop: 9 }}>
      {templates.data?.length ? templates.data.slice(0, size === "l" ? 5 : 3).map((template, index) =>
        <View key={template.id} style={{ flex: 1, minHeight: 49, flexDirection: "row", alignItems: "center", gap: 9,
          borderTopWidth: index === 0 ? 0 : 1, borderTopColor: "rgba(42,42,49,0.6)" }}>
          <Pressable onPress={() => router.push({ pathname: "/templates/[id]", params: { id: template.id } })}
            style={{ flex: 1, minWidth: 0 }} accessibilityRole="link">
            <Text weight="semibold" numberOfLines={1} style={{ fontSize: 14 }}>{template.name}</Text>
            <Text variant="caption" tone="faint" numberOfLines={1} style={{ fontSize: 11 }}>
              {template.type} · {translateCount(lang, "count.exercises", template.exerciseCount)}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: "/new", params: { template: template.id } })}
            accessibilityRole="button" style={{ height: 32, borderRadius: 18, paddingHorizontal: 11, backgroundColor: colors.lime,
              flexDirection: "row", alignItems: "center", gap: 4 }}>
            <HomeTileIcon name="play" size={12} color={colors.black} />
            <Text variant="caption" weight="semibold" style={{ color: colors.black }}>{t("templates.start")}</Text>
          </Pressable>
        </View>) : <Text variant="caption" tone="muted" style={{ marginTop: 20 }}>{t("templates.emptyHint")}</Text>}
    </View>
  </Card>;

  if (type === "quickActions") {
    const actions = [
      { icon: "plus" as const, label: t("widget.quickActions.workout"), onPress: () => router.push("/new") },
      { icon: "scale" as const, label: t("widget.quickActions.weight"), onPress: () => router.push({ pathname: "/settings", params: { open: "weight" } }) },
      { icon: "template" as const, label: t("templates.title"), onPress: () => router.push({ pathname: "/library", params: { tab: "templates" } }) },
      { icon: "chart" as const, label: t("nav.progress"), onPress: () => router.push("/progress") },
    ];
    return <Card variant="stat" padding={16} radius={22} style={{ minHeight: 157 }}>
      <HomeTileHead label={t("widget.quickActions.title")} />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 7, paddingTop: 16 }}>
        {actions.map((action, index) => <Pressable key={action.label} onPress={action.onPress} style={{ flex: 1, alignItems: "center", gap: 6 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: index === 0 ? colors.lime : colors.raised,
            borderWidth: index === 0 ? 0 : 1, borderColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" }}>
            <HomeTileIcon name={action.icon} size={22} color={index === 0 ? colors.black : colors.text} />
          </View>
          <Text variant="caption" tone="muted" numberOfLines={1} style={{ fontSize: 11 }}>{action.label}</Text>
        </Pressable>)}
      </View>
    </Card>;
  }

  if (type === "repeatLast") return <Pressable onPress={() => history[0] && router.push({ pathname: "/new", params: { repeat: history[0].id } })}
    style={{ flex: 1 }} accessibilityRole="button">
    <Card variant="stat" padding={16} radius={20} style={{ minHeight: 145, flex: 1 }}>
      <HomeTileHead label={t("widget.repeatLast.title")} icon="repeat" tone="lime" />
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Text weight="semibold" numberOfLines={1} style={{ fontSize: 20 }}>{history[0]?.type ?? t("home.emptyTitle")}</Text>
        {history[0] ? <Text variant="caption" tone="faint">{formatDate(history[0].date, lang)} · {translateCount(lang, "count.exercises", history[0].workout_exercises.length)}</Text> : null}
      </View>
    </Card>
  </Pressable>;

  if (type === "weeklyGoal") {
    const target = schedule.filter(Boolean).length || 3;
    const done = week.workouts;
    const radius = 31;
    const circumference = 2 * Math.PI * radius;
    const ring = <View style={{ width: 76, height: 76, alignItems: "center", justifyContent: "center" }}>
      <Svg width={76} height={76} viewBox="0 0 76 76">
        <Circle cx={38} cy={38} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={7} />
        {done > 0 ? <Circle cx={38} cy={38} r={radius} fill="none" stroke={colors.lime} strokeWidth={7}
          strokeDasharray={`${circumference * Math.min(done / target, 1)} ${circumference}`} strokeLinecap="round" rotation={-90} origin="38,38" /> : null}
      </Svg>
      <View pointerEvents="none" style={{ position: "absolute", flexDirection: "row", alignItems: "baseline" }}>
        <DotValue value={done} size={20} /><Text variant="caption" tone="muted">/{target}</Text>
      </View>
    </View>;
    return <Pressable onPress={() => router.push("/history")} style={{ flex: 1 }} accessibilityRole="button">
      <Card variant="stat" padding={16} radius={20} style={{ minHeight: 145, flex: 1 }}>
        <HomeTileHead label={t("widget.weeklyGoal.title")} icon="target" tone="lime" />
        {size === "s" ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{ring}</View> :
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 13 }}>
            {ring}<View style={{ flex: 1 }}><Text weight="semibold" numberOfLines={2}>{t("widget.weeklyGoal.progress", { done, target })}</Text>
              <Text variant="caption" tone="muted">{done >= target ? t("widget.weeklyGoal.reached") :
                translateCount(lang, "widget.weeklyGoal.remaining", Math.max(target - done, 0))}</Text></View>
          </View>}
      </Card>
    </Pressable>;
  }

  if (type === "weeklyVolume") {
    const current = kgToUnit(week.volumeKg, unit);
    const comparison = percent(week.volumeKg, previousWeek.volumeKg);
    return <Pressable onPress={() => router.push("/progress")} style={{ flex: 1 }} accessibilityRole="button">
      <Card variant="stat" padding={16} radius={20} style={{ minHeight: 145, flex: 1 }}>
        <HomeTileHead label={t("widget.weeklyVolume.title")} />
        <View style={{ flex: 1, flexDirection: size === "m" ? "row" : "column", alignItems: size === "m" ? "flex-end" : "stretch",
          justifyContent: "flex-end", gap: 8 }}>
          <View><DotValue value={compact(current)} suffix={unit} size={31} />
            {comparison ? <Text variant="caption" tone={week.volumeKg >= previousWeek.volumeKg ? "lime" : "pink"}>
              {comparison} <Text tone="faint">{t("widget.weeklyVolume.vsLast")}</Text>
            </Text> : null}
          </View>
          {size === "m" ? <View style={{ flex: 1, minWidth: 90 }}><WeeklyVolumeBars history={history} unit={unit} lang={lang} today={today} /></View> : null}
        </View>
      </Card>
    </Pressable>;
  }

  if (type === "monthSummary") {
    const current = periodTotals(history.filter((workout) => workout.date >= monthFrom));
    const previous = periodTotals(history.filter((workout) => workout.date >= prevMonthFrom && workout.date <= prevMonthEnd));
    const fields = [
      { label: t("progress.workouts"), current: current.workouts, previous: previous.workouts, suffix: "" },
      { label: t("progress.sets"), current: current.sets, previous: previous.sets, suffix: "" },
      { label: t("stats.volume"), current: kgToUnit(current.volumeKg, unit), previous: kgToUnit(previous.volumeKg, unit), suffix: unit },
    ];
    return <Pressable onPress={() => router.push("/progress")} accessibilityRole="button">
      <Card variant="stat" padding={16} radius={22} style={{ minHeight: 145 }}>
        <HomeTileHead label={t("widget.monthSummary.title", { month: today.toLocaleDateString(lang, { month: "long" }) })}
          action={<Text variant="caption" tone="faint">{t("widget.monthSummary.vs")}</Text>} />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 9, paddingTop: 21 }}>
          {fields.map((field) => <View key={field.label} style={{ flex: 1, minWidth: 0 }}>
            <Text variant="micro" tone="muted" numberOfLines={1}>{field.label}</Text>
            <DotValue value={compact(field.current)} suffix={field.suffix || undefined} size={22} />
            <Text variant="caption" tone={field.current >= field.previous ? "lime" : "pink"}>
              {percent(field.current, field.previous) ?? " "}
            </Text>
          </View>)}
        </View>
      </Card>
    </Pressable>;
  }

  if (type === "personalRecords") {
    const records = personalRecords(history, lookbackStart("3m", today)).slice(0, size === "l" ? 5 : 2);
    return <Card variant="stat" padding={16} radius={22} style={{ minHeight: 150 }}>
      <HomeTileHead label={t("widget.personalRecords.name")} icon="trophy" tone="lime" />
      <View style={{ marginTop: 12 }}>
        {records.length ? records.map((record, index) => {
          const itemUnit = record.exerciseUnit ?? unit;
          const isReps = record.kind === "reps";
          const value = isReps ? record.value : roundWeight(kgToUnit(record.value, itemUnit));
          const gain = isReps ? record.value - record.previous : roundWeight(kgToUnit(record.value - record.previous, itemUnit));
          return <Pressable key={`${record.exerciseId}-${record.date}-${index}`}
            onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: record.exerciseId } })}
            style={{ flexDirection: "row", alignItems: "center", gap: 9, minHeight: 56,
              borderTopWidth: index === 0 ? 0 : 1, borderTopColor: "rgba(42,42,49,0.6)" }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(215,246,81,0.1)",
              borderWidth: 1, borderColor: "rgba(215,246,81,0.2)", alignItems: "center", justifyContent: "center" }}>
              <HomeTileIcon name="trophy" size={13} color={colors.lime} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}><Text weight="semibold" numberOfLines={1} style={{ fontSize: 14 }}>{record.exerciseName}</Text>
              <Text variant="caption" tone="faint" numberOfLines={1} style={{ fontSize: 11 }}>
                {t(`progress.record.${record.kind}`)} · {shortDate(record.date, lang)}
              </Text></View>
            <View style={{ alignItems: "flex-end" }}><DotValue value={value} suffix={isReps ? t("progress.repsShort") : itemUnit} size={18} />
              <Text variant="caption" tone="lime" style={{ fontSize: 11 }}>+{gain}</Text></View>
          </Pressable>;
        }) : <Text variant="caption" tone="muted">{t("progress.recordsEmpty")}</Text>}
      </View>
    </Card>;
  }

  if (type === "strongestLifts") {
    const lifts = bestLifts(history, size === "l" ? 5 : 3);
    return <Pressable onPress={() => router.push("/progress")} accessibilityRole="button">
      <Card variant="stat" padding={16} radius={22} style={{ minHeight: 150 }}>
        <HomeTileHead label={t("widget.strongestLifts.name")}
          action={<Text variant="caption" tone="faint">{t("stats.oneRmShort")}</Text>} />
        <View style={{ marginTop: 12 }}>{lifts.length ? lifts.map((lift, index) => {
          const itemUnit = lift.exerciseUnit ?? unit;
          return <View key={lift.exerciseId} style={{ minHeight: 47, justifyContent: "center", flexDirection: "row", alignItems: "center",
            borderTopWidth: index === 0 ? 0 : 1, borderTopColor: "rgba(42,42,49,0.6)" }}>
            <View style={{ flex: 1, minWidth: 0 }}><Text weight="semibold" numberOfLines={1} style={{ fontSize: 14 }}>{lift.exerciseName}</Text>
              {size === "l" ? <Text variant="caption" tone="faint" numberOfLines={1} style={{ fontSize: 11 }}>
                {roundWeight(kgToUnit(lift.weightKg, itemUnit))} × {lift.reps} · {formatDate(lift.date, lang)}
              </Text> : null}
            </View>
            <DotValue value={roundWeight(kgToUnit(lift.oneRmKg, itemUnit))} suffix={itemUnit} size={17} />
          </View>;
        }) : <Text variant="caption" tone="muted">{t("progress.emptyHint")}</Text>}</View>
      </Card>
    </Pressable>;
  }

  if (type === "muscleBalance") {
    const from = lookbackStart("1m", today)!;
    const allCounts = setsByMuscleGroup(history.filter((workout) => workout.date >= from));
    const counts = [...allCounts].sort((a, b) => b[1] - a[1]).slice(0, size === "l" ? 8 : 3);
    const groupNames = new Map((groups.data ?? []).map((group) => [group.id, group.name]));
    const max = counts[0]?.[1] ?? 1;
    const total = [...allCounts.values()].reduce((sum, value) => sum + value, 0);
    return <Pressable onPress={() => router.push("/progress")} accessibilityRole="button">
      <Card variant="stat" padding={16} radius={22} style={{ minHeight: 148 }}>
        <HomeTileHead label={t("widget.muscleBalance.title")}
          action={<Text variant="caption" tone="faint">{t("period.over.1m")}</Text>} />
        <View style={{ marginTop: 15, gap: 12 }}>
          {counts.length ? counts.map(([id, count], index) => <View key={id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
              <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>{groupNames.get(id) ?? ""}</Text>
              <Text variant="caption" tone="muted">{translateCount(lang, "count.sets", count)} <Text tone="faint" style={{ fontSize: 11 }}>{total ? Math.round(count / total * 100) : 0}%</Text></Text>
            </View>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <View style={{ width: `${Math.max(3, count / max * 100)}%`, height: 5, borderRadius: 3,
                backgroundColor: index === 0 ? colors.lime : "#677cf0" }} />
            </View>
          </View>) : <Text variant="caption" tone="muted">{t("progress.muscleEmpty")}</Text>}
        </View>
      </Card>
    </Pressable>;
  }

  return null;
}
