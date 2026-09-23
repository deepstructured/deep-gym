import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
  bestLifts,
  percentChange,
  periodTotals,
  personalRecords,
  setsByMuscleGroup,
  weeklyBuckets,
  workoutsBetween,
  workoutsForGroup,
  type PeriodTotals,
} from "@deepgym/core/analytics";
import { translateCount } from "@deepgym/core/i18n";
import {
  formatWeeklyActivityAxis,
  formatWeeklyActivityRange,
  formatWeeklyActivityValue,
  weeklyActivityValue,
  type WeeklyActivityMetric,
} from "@deepgym/core/weekly-activity";
import type { Workout } from "@deepgym/core/types";
import { formatWeight, kgToUnit, roundWeight, type Unit } from "@deepgym/core/weight";
import { useBodyWeightMeasurements } from "../data/body-weight";
import { colors } from "../theme";
import { Button, Card, Chip, DotValue, Screen, Segmented, Text } from "../ui";
import { useMuscleGroups, useProfile, useWorkouts } from "../data/queries";
import { useI18n } from "../providers/locale-provider";
import { ErrorState, Header, LoadingState } from "./common";
import { ChartPeriodSwitch, ProgressExerciseExplorer, ProgressTrendLine } from "./progress-extras";
import { calendarDaysSince, calendarWeeksSince, lookbackStart, previousLookbackRange } from "./period-range";
import { usePreferredPeriod } from "./use-preferred-period";

const EMPTY_WORKOUTS: Workout[] = [];

function OverviewTile({ label, value, suffix, delta }: {
  label: string;
  value: string | number;
  suffix?: string;
  delta: number | null;
}) {
  const { t } = useI18n();
  return (
    <Card variant="stat" radius={20} padding={16} style={{ flex: 1, minHeight: 102 }}>
      <Text variant="micro" tone="muted">{label}</Text>
      <DotValue value={value} suffix={suffix} size={29} style={{ marginTop: 13 }} />
      {delta != null && Number.isFinite(delta) ? (
        <Text variant="caption" tone={delta > 0.5 ? "lime" : delta < -0.5 ? "pink" : "faint"} style={{ marginTop: 3 }}>
          {delta > 0.5 ? "▲" : delta < -0.5 ? "▼" : "•"} {Math.abs(Math.round(delta))}% <Text variant="caption" tone="faint">{t("progress.vsPrevious")}</Text>
        </Text>
      ) : <View style={{ height: 17 }} />}
    </Card>
  );
}

function overviewDelta(current: number, previous: number | undefined): number | null {
  return previous ? percentChange(current, previous) : null;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <View style={{ marginBottom: 24 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
      <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{title}</Text>
      {action}
    </View>
    {children}
  </View>;
}

function PeriodOverview({ current, previous, unit }: { current: PeriodTotals; previous: PeriodTotals | null; unit: Unit }) {
  const { t } = useI18n();
  const volume = kgToUnit(current.volumeKg, unit);
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: "row", gap: 10 }}>
      <OverviewTile label={t("progress.workouts")} value={current.workouts} delta={overviewDelta(current.workouts, previous?.workouts)} />
      <OverviewTile label={t("progress.sets")} value={current.sets} delta={overviewDelta(current.sets, previous?.sets)} />
    </View>
    <View style={{ flexDirection: "row", gap: 10 }}>
      <OverviewTile label={t("stats.volume")} value={Math.abs(volume) >= 1000 ? `${roundWeight(volume / 1000)}k` : roundWeight(volume)} suffix={unit} delta={overviewDelta(current.volumeKg, previous?.volumeKg)} />
      <OverviewTile label={t("stats.perWeekShort")} value={current.perWeek} suffix="×" delta={overviewDelta(current.perWeek, previous?.perWeek)} />
    </View>
  </View>;
}

export function ProgressScreen() {
  const { t, lang } = useI18n();
  const profile = useProfile();
  const workouts = useWorkouts();
  const groups = useMuscleGroups();
  const bodyWeight = useBodyWeightMeasurements({ limit: 1000 });
  const [periodKey, setPeriodKey] = usePreferredPeriod();
  const [focus, setFocus] = useState<string | null>(null);
  const [metric, setMetric] = useState<WeeklyActivityMetric>("workouts");
  const [activeWeekStart, setActiveWeekStart] = useState<string | null>(null);
  const [bodySelectedIndex, setBodySelectedIndex] = useState<number | null>(null);
  useEffect(() => setBodySelectedIndex(null), [periodKey]);
  const today = new Date();
  const since = lookbackStart(periodKey, today);
  const previousRange = previousLookbackRange(periodKey, today);
  const all = workouts.data ?? EMPTY_WORKOUTS;
  const groupIdsWithData = useMemo(() => new Set(all.flatMap((workout) => workout.workout_exercises.map((entry) => entry.exercise?.muscle_group_id).filter(Boolean))), [all]);
  const focusGroups = (groups.data ?? []).filter((group) => groupIdsWithData.has(group.id));
  const focusedGroupId = focusGroups.some((group) => group.id === focus) ? focus : null;
  const groupWorkouts = useMemo(() => workoutsForGroup(all, focusedGroupId), [all, focusedGroupId]);
  const filtered = useMemo(() => workoutsBetween(groupWorkouts, since), [groupWorkouts, since]);
  const spanDays = since ? calendarDaysSince(since, today) : undefined;
  const totals = periodTotals(filtered, spanDays);
  const previous = previousRange
    ? periodTotals(workoutsBetween(groupWorkouts, previousRange.from, previousRange.to), spanDays)
    : null;
  const oldestDate = groupWorkouts.reduce<string | null>((oldest, workout) => !oldest || workout.date < oldest ? workout.date : oldest, null);
  const weeks = periodKey === "1m" ? 5 : periodKey === "3m" ? 13 : periodKey === "6m" ? 26 : periodKey === "1y" ? 52 : calendarWeeksSince(oldestDate, today);
  const buckets = weeklyBuckets(filtered, weeks);
  const maxBar = Math.max(1, ...buckets.map((bucket) => weeklyActivityValue(bucket, metric)));
  const requestedWeekIndex = buckets.findIndex((bucket) => bucket.start === activeWeekStart);
  const activeWeekIndex = requestedWeekIndex >= 0 ? requestedWeekIndex : buckets.length - 1;
  const activeWeek = buckets[activeWeekIndex];
  const lifts = bestLifts(filtered, 5);
  const records = personalRecords(groupWorkouts, since).slice(0, 6);
  const balance = [...setsByMuscleGroup(filtered)].sort((a, b) => b[1] - a[1]);
  const groupName = new Map((groups.data ?? []).map((group) => [group.id, group.name]));
  const maxBalance = Math.max(1, ...balance.map(([, count]) => count));
  const totalBalance = balance.reduce((sum, [, count]) => sum + count, 0);
  const unit = profile.data?.unit ?? "kg";
  const bodyRows = (bodyWeight.data ?? []).filter((row) => !since || row.measured_at.slice(0, 10) >= since).slice().reverse();
  const shownBodyWeight = bodyRows[bodySelectedIndex ?? bodyRows.length - 1] ?? bodyRows.at(-1);
  const bodyDelta = bodyRows.length > 1
    ? roundWeight(kgToUnit(bodyRows.at(-1)!.weight_kg - bodyRows[0].weight_kg, unit))
    : null;

  return (
    <Screen bottomPadding={122}>
      <Header title={t("nav.progress")} profile={profile.data} />
      <ChartPeriodSwitch value={periodKey} onChange={setPeriodKey} style={{ marginTop: 10, marginBottom: 18 }} />

      {workouts.isLoading || profile.isLoading ? <LoadingState /> : null}
      {workouts.error ? <ErrorState message={workouts.error.message} retry={() => workouts.refetch()} /> : null}
      {!workouts.isLoading && !workouts.error && !all.length ? (
        <Card style={{ marginTop: 8 }} contentStyle={{ alignItems: "center", paddingVertical: 32 }}>
          <Ionicons name="stats-chart-outline" size={32} color={colors.lime} style={{ marginBottom: 16 }} />
          <Text variant="title" style={{ textAlign: "center" }}>{t("progress.emptyTitle")}</Text>
          <Text tone="muted" style={{ textAlign: "center", lineHeight: 21, maxWidth: 280, marginTop: 8 }}>
            {t("progress.emptyHint")}
          </Text>
          <Button variant="lime" block style={{ marginTop: 24 }} onPress={() => router.push("/new")}>{t("home.startWorkout")}</Button>
        </Card>
      ) : all.length ? <>
        {focusGroups.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 18 }}>
          <Chip selected={!focusedGroupId} onPress={() => setFocus(null)}>{t("progress.allGroups")}</Chip>
          {focusGroups.map((group) => <Chip key={group.id} selected={focusedGroupId === group.id} onPress={() => setFocus(focusedGroupId === group.id ? null : group.id)}>{group.name}</Chip>)}
        </ScrollView> : null}

        <View style={{ marginBottom: 26 }}><PeriodOverview current={totals} previous={previous} unit={unit} /></View>

        <Section title={t("progress.activity")}>
          <Card padding={16} radius={23}>
            <Segmented value={metric} onChange={setMetric} options={[
              { value: "workouts", label: t("progress.workouts") },
              { value: "sets", label: t("progress.sets") },
              { value: "volumeKg", label: t("stats.volume") },
            ]} />
            {activeWeek ? <View style={{ marginTop: 14, marginBottom: 14, gap: 3 }}>
              <Text weight="semibold" style={{ fontSize: 16, lineHeight: 21 }}>
                {formatWeeklyActivityValue(activeWeek, metric, unit, lang)}
              </Text>
              <Text variant="caption" tone="muted">
                {activeWeekIndex === buckets.length - 1 ? <Text variant="caption" tone="lime">{t("progress.currentWeek")} · </Text> : null}
                {formatWeeklyActivityRange(activeWeek.start, lang)}
              </Text>
            </View> : null}
            <View style={{ height: 116, flexDirection: "row", alignItems: "flex-end", gap: buckets.length > 30 ? 2 : 4 }}>
              {buckets.map((bucket, index) => {
                const value = weeklyActivityValue(bucket, metric);
                return <Pressable key={bucket.start} onPress={() => setActiveWeekStart(bucket.start)} accessibilityRole="button" accessibilityState={{ selected: index === activeWeekIndex }} accessibilityLabel={`${formatWeeklyActivityRange(bucket.start, lang)}: ${formatWeeklyActivityValue(bucket, metric, unit, lang)}`} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: 116 }}>
                  <View style={{ width: "100%", maxWidth: 20, height: Math.max(value > 0 ? 6 : 3, (value / maxBar) * 109), borderRadius: 5, backgroundColor: index === buckets.length - 1 ? colors.lime : activeWeekIndex === index ? colors.white : value > 0 ? "#55555b" : colors.line }} />
                </Pressable>;
              })}
            </View>
            {buckets.length > 0 ? <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text variant="caption" tone="faint" style={{ fontSize: 10 }}>{formatWeeklyActivityAxis(buckets[0].start, lang)}</Text>
              {buckets.length > 2 ? <Text variant="caption" tone="faint" style={{ fontSize: 10 }}>{formatWeeklyActivityAxis(buckets[Math.floor((buckets.length - 1) / 2)].start, lang)}</Text> : null}
              <Text variant="caption" tone="faint" style={{ fontSize: 10 }}>{formatWeeklyActivityAxis(buckets[buckets.length - 1].start, lang)}</Text>
            </View> : null}
            <Text variant="caption" tone="faint" style={{ fontSize: 10, lineHeight: 14, marginTop: 10 }}>{t("progress.weeklyHint")}</Text>
          </Card>
        </Section>

        <Section title={t("progress.exercises")}>
          <ProgressExerciseExplorer workouts={all} since={since} focus={focusedGroupId} unit={unit} groups={groups.data ?? []} period={periodKey} onPeriodChange={setPeriodKey} />
        </Section>

        <Section title={t("progress.records")}>
          <Card padding={16} radius={23}>
            {records.length ? records.map((record, index) => {
              const displayUnit = record.exerciseUnit ?? unit;
              const reps = record.kind === "reps";
              return <Pressable key={`${record.exerciseId}-${record.date}-${index}`} onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: record.exerciseId } })} style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: colors.line }}>
                <View style={{ width: 29, height: 29, borderRadius: 15, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" }}><Ionicons name="trophy-outline" size={15} color={colors.lime} /></View>
                <View style={{ flex: 1 }}><Text weight="semibold" numberOfLines={1}>{record.exerciseName}</Text><Text variant="caption" tone="faint">{t(`progress.record.${record.kind}`)} · {new Date(`${record.date}T12:00:00`).toLocaleDateString(lang, { month: "short", day: "numeric" })}</Text></View>
                <View style={{ alignItems: "flex-end" }}><Text weight="semibold">{reps ? `${record.value} ${t("progress.repsShort")}` : formatWeight(record.value, displayUnit)}</Text><Text variant="caption" tone="lime">+{reps ? record.value - record.previous : roundWeight(kgToUnit(record.value - record.previous, displayUnit))}</Text></View>
              </Pressable>;
            }) : <Text tone="muted">{t("progress.recordsEmpty")}</Text>}
          </Card>
        </Section>

        {lifts.length ? <Section title={t("progress.strongest")}>
          <Card padding={16} radius={23}>
            {lifts.map((lift, index) => {
              const displayUnit = lift.exerciseUnit ?? unit;
              return <Pressable key={lift.exerciseId} onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: lift.exerciseId } })} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: colors.line }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" }}><DotValue value={index + 1} size={14} color={colors.muted} /></View>
                <View style={{ flex: 1 }}><Text weight="semibold" numberOfLines={1}>{lift.exerciseName}</Text><Text variant="caption" tone="faint">{formatWeight(lift.weightKg, displayUnit)} × {lift.reps}</Text></View>
                <View style={{ alignItems: "flex-end" }}><DotValue value={roundWeight(kgToUnit(lift.oneRmKg, displayUnit))} size={18} /><Text variant="micro" tone="faint">{t("stats.metric.oneRm")}, {displayUnit}</Text></View>
              </Pressable>;
            })}
          </Card>
        </Section> : null}

        {!focusedGroupId ? <Section title={t("progress.muscleGroups")}>
          <Card padding={16} radius={23}>
            {balance.length ? balance.map(([id, count], index) => <View key={id} style={{ marginBottom: index === balance.length - 1 ? 0 : 15 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text weight="medium">{groupName.get(id) ?? ""}</Text>
                <Text tone="muted">{translateCount(lang, "count.sets", count)} <Text tone="faint">{Math.round(count / totalBalance * 100)}%</Text></Text>
              </View>
              <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.raised }}>
                <View style={{ height: 7, width: `${Math.max(3, count / maxBalance * 100)}%`, borderRadius: 4, backgroundColor: index === 0 ? colors.lime : "#8a9d3c" }} />
              </View>
            </View>) : <Text tone="muted">{t("progress.muscleEmpty")}</Text>}
          </Card>
        </Section> : null}

        <Section title={t("bodyWeight.title")} action={<Pressable onPress={() => router.push({ pathname: "/settings", params: { open: "weight" } })} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="add" size={16} color={colors.lime} />
          <Text variant="caption" tone="lime" weight="semibold">{t("bodyWeight.record")}</Text>
        </Pressable>}>
          <Card padding={16} radius={23}>
            {bodyRows.length ? <>
              <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, paddingHorizontal: 3 }}>
                <View style={{ flexShrink: 1 }}>
                  <DotValue value={roundWeight(kgToUnit(shownBodyWeight!.weight_kg, unit))} suffix={unit} size={30} />
                  <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                    {new Date(`${shownBodyWeight!.measured_at.slice(0, 10)}T12:00:00`).toLocaleDateString(lang, { month: "short", day: "numeric", year: "numeric" })}
                  </Text>
                </View>
                {bodySelectedIndex == null && bodyDelta != null ? <View style={{ alignItems: "flex-end", paddingBottom: 2 }}>
                  <DotValue value={`${bodyDelta > 0 ? "+" : bodyDelta < 0 ? "−" : ""}${Math.abs(bodyDelta)}`} suffix={unit} size={16} color={colors.lime} />
                  <Text variant="micro" tone="faint" style={{ marginTop: 2 }}>{t(`period.over.${periodKey}`)}</Text>
                </View> : null}
              </View>
              <View style={{ marginTop: 13 }}><ProgressTrendLine values={bodyRows.map((row) => kgToUnit(row.weight_kg, unit))} dates={bodyRows.map((row) => row.measured_at.slice(0, 10))} locale={lang} chartId="bodyTrend" height={150} color={colors.lime} framed activeIndex={bodySelectedIndex} onActiveChange={setBodySelectedIndex} /></View>
            </> : <Text tone="muted">{t("bodyWeight.historyEmptyHint")}</Text>}
          </Card>
        </Section>
      </> : null}
    </Screen>
  );
}
