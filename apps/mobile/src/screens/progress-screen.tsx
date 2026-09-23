import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
  bestLifts,
  periodTotals,
  personalRecords,
  setsByMuscleGroup,
  weeklyBuckets,
  workoutsForGroup,
} from "@deepgym/core/analytics";
import { formatWeight } from "@deepgym/core/weight";
import { colors } from "../theme";
import { Card, Chip, DotValue, Screen, Segmented, Text } from "../ui";
import { useMuscleGroups, useProfile, useWorkouts } from "../data/queries";
import { useI18n } from "../providers/locale-provider";
import { localISO } from "./format";
import { ErrorState, Header, LoadingState } from "./common";

type Period = "1M" | "3M" | "6M" | "1Y" | "All";
type ActivityMetric = "workouts" | "sets" | "volumeKg";

function periodStart(period: Period): string | null {
  if (period === "All") return null;
  const date = new Date();
  if (period === "1Y") date.setFullYear(date.getFullYear() - 1);
  else date.setMonth(date.getMonth() - Number(period[0]));
  return localISO(date);
}

function OverviewTile({ label, value, suffix }: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <Card variant="stat" radius={20} padding={16} style={{ flex: 1, minHeight: 102 }}>
      <Text variant="micro" tone="muted">{label}</Text>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <DotValue value={value} suffix={suffix} size={29} />
      </View>
    </Card>
  );
}

export function ProgressScreen() {
  const { t } = useI18n();
  const profile = useProfile();
  const workouts = useWorkouts();
  const groups = useMuscleGroups();
  const [period, setPeriod] = useState<Period>("3M");
  const [focus, setFocus] = useState<string | null>(null);
  const [metric, setMetric] = useState<ActivityMetric>("workouts");
  const since = periodStart(period);
  const all = workouts.data ?? [];
  const filtered = useMemo(() =>
    workoutsForGroup(all, focus).filter((workout) => !since || workout.date >= since),
    [all, focus, since],
  );
  const spanDays = since
    ? Math.max(1, Math.round((Date.now() - new Date(`${since}T12:00:00`).getTime()) / 86_400_000))
    : undefined;
  const totals = periodTotals(filtered, spanDays);
  const buckets = weeklyBuckets(filtered, period === "1M" ? 5 : period === "3M" ? 13 : 20);
  const maxBar = Math.max(1, ...buckets.map((bucket) => bucket[metric]));
  const lifts = bestLifts(filtered, 5);
  const records = personalRecords(workoutsForGroup(all, focus), since).slice(0, 5);
  const balance = [...setsByMuscleGroup(filtered)].sort((a, b) => b[1] - a[1]);
  const groupName = new Map((groups.data ?? []).map((group) => [group.id, group.name]));
  const maxBalance = Math.max(1, ...balance.map(([, count]) => count));

  return (
    <Screen bottomPadding={122}>
      <Header title={t("nav.progress")} profile={profile.data} />
      <Segmented
        value={period}
        onChange={setPeriod}
        options={(["1M", "3M", "6M", "1Y", "All"] as const).map((value) => ({ value, label: value }))}
        style={{ marginTop: 10, marginBottom: 18 }}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
        <Chip selected={!focus} onPress={() => setFocus(null)}>{t("progress.allGroups")}</Chip>
        {(groups.data ?? []).map((group) => (
          <Chip key={group.id} selected={focus === group.id} onPress={() => setFocus(group.id)}>
            {group.name}
          </Chip>
        ))}
      </ScrollView>

      {workouts.isLoading || profile.isLoading ? <LoadingState /> : null}
      {workouts.error ? <ErrorState message={workouts.error.message} retry={() => workouts.refetch()} /> : null}

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <OverviewTile label={t("progress.workouts")} value={totals.workouts} />
        <OverviewTile label={t("progress.sets")} value={totals.sets} />
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 22 }}>
        <OverviewTile label={t("stats.volume")} value={totals.volumeKg >= 1000 ? `${(totals.volumeKg / 1000).toFixed(1)}k` : Math.round(totals.volumeKg)} suffix="kg" />
        <OverviewTile label={t("stats.perWeek")} value={totals.perWeek} suffix="×" />
      </View>

      <Text variant="title" style={{ marginBottom: 14 }}>{t("progress.activity")}</Text>
      <Card style={{ marginBottom: 25 }}>
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { value: "workouts", label: t("progress.workouts") },
            { value: "sets", label: t("progress.sets") },
            { value: "volumeKg", label: t("stats.volume") },
          ]}
        />
        <View style={{ height: 155, flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 22 }}>
          {buckets.map((bucket) => {
            const value = bucket[metric];
            return (
              <View key={bucket.start} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: 145 }}>
                <View style={{
                  width: "100%",
                  height: Math.max(3, (value / maxBar) * 135),
                  borderRadius: 5,
                  backgroundColor: value > 0 ? colors.lime : colors.line,
                  opacity: value > 0 ? 0.9 : 0.5,
                }} />
              </View>
            );
          })}
        </View>
      </Card>

      <Text variant="title" style={{ marginBottom: 12 }}>{t("progress.strongest")}</Text>
      <Card style={{ marginBottom: 25 }} padding={0}>
        {lifts.length ? lifts.map((lift, index) => (
          <Pressable
            key={lift.exerciseId}
            onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: lift.exerciseId } })}
            style={{ padding: 16, borderBottomWidth: index < lifts.length - 1 ? 1 : 0, borderBottomColor: colors.line }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text tone="lime" weight="bold">{index + 1}</Text>
              <Text style={{ flex: 1 }} numberOfLines={1}>{lift.exerciseName}</Text>
              <Text tone="muted">{formatWeight(lift.oneRmKg, lift.exerciseUnit ?? profile.data?.unit ?? "kg")}</Text>
            </View>
          </Pressable>
        )) : <Text tone="muted" style={{ padding: 20 }}>{t("progress.emptyHint")}</Text>}
      </Card>

      {records.length ? (
        <>
          <Text variant="title" style={{ marginBottom: 12 }}>{t("progress.records")}</Text>
          <Card style={{ marginBottom: 25 }} padding={0}>
            {records.map((record, index) => (
              <Pressable
                key={`${record.exerciseId}-${record.date}-${index}`}
                onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: record.exerciseId } })}
                style={{ padding: 16, borderBottomWidth: index < records.length - 1 ? 1 : 0, borderBottomColor: colors.line }}
              >
                <Text>{record.exerciseName}</Text>
                <Text variant="caption" tone="muted">{record.date} · {record.kind === "reps" ? `${record.value} ${t("progress.repsShort")}` : formatWeight(record.value, record.exerciseUnit ?? profile.data?.unit ?? "kg")}</Text>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      {!focus && balance.length ? (
        <>
          <Text variant="title" style={{ marginBottom: 12 }}>{t("progress.muscleGroups")}</Text>
          <Card style={{ marginBottom: 24 }}>
            {balance.map(([id, count]) => (
              <View key={id} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                  <Text>{groupName.get(id) ?? "Group"}</Text>
                  <Text tone="muted">{count}</Text>
                </View>
                <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.raised }}>
                  <View style={{ height: 7, width: `${(count / maxBalance) * 100}%`, borderRadius: 4, backgroundColor: colors.lime }} />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
