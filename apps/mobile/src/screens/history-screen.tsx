import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { scheduledWorkoutOn } from "@deepgym/core/next-workout";
import { colors, radii } from "../theme";
import { BottomSheet, Button, Card, DotValue, GradientCard, Screen, Segmented, Text } from "../ui";
import { useProfile, useWorkouts } from "../data/queries";
import { useI18n } from "../providers/locale-provider";
import { fromISO, localISO } from "./format";
import { ErrorState, Header, LoadingState, WorkoutCard } from "./common";

type ViewMode = "day" | "week" | "month";

function validDateParam(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return localISO(fromISO(value)) === value ? value : null;
}

function mondayOf(date: Date): Date {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function periodLabel(date: Date, mode: ViewMode, lang: string): string {
  if (mode === "day") {
    return date.toLocaleDateString(lang, { weekday: "long", month: "long", day: "numeric" });
  }
  if (mode === "month") {
    return date.toLocaleDateString(lang, { month: "long", year: "numeric" });
  }
  const monday = mondayOf(date);
  const sunday = addDays(monday, 6);
  const from = monday.toLocaleDateString(lang, { month: "short", day: "numeric" });
  const to = sunday.toLocaleDateString(lang, { month: "short", day: "numeric" });
  return `${from} – ${to}`;
}

export function HistoryScreen() {
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ first?: string; date?: string }>();
  const routeDate = validDateParam(params.date);
  const profile = useProfile();
  const workouts = useWorkouts();
  const [selected, setSelected] = useState(() => routeDate ?? localISO());
  const [mode, setMode] = useState<ViewMode>("day");
  useEffect(() => {
    if (routeDate) setSelected(routeDate);
  }, [routeDate]);
  const selectedDate = fromISO(selected);
  const days = useMemo(() => {
    if (mode === "day") return [];
    if (mode === "week") {
      const monday = mondayOf(selectedDate);
      return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
    }
    const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const start = mondayOf(first);
    const last = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    const length = Math.ceil(((last.getTime() - start.getTime()) / 86_400_000 + 1) / 7) * 7;
    return Array.from({ length }, (_, index) => addDays(start, index));
  }, [selected, mode]);
  const byDate = useMemo(() => {
    const dates = new Map<string, number>();
    for (const workout of workouts.data ?? []) {
      dates.set(workout.date, (dates.get(workout.date) ?? 0) + 1);
    }
    return dates;
  }, [workouts.data]);
  const selectedWorkouts = (workouts.data ?? []).filter((workout) => workout.date === selected);
  const planned = selectedWorkouts.length === 0
    ? scheduledWorkoutOn(profile.data?.training_schedule, selected)
    : null;

  function shift(direction: number) {
    const next = new Date(selectedDate);
    if (mode === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * (mode === "week" ? 7 : 1));
    setSelected(localISO(next));
  }

  function dismissFirstWorkoutSuccess() {
    router.replace({ pathname: "/history", params: routeDate ? { date: routeDate } : {} });
  }

  return (
    <Screen bottomPadding={122}>
      <Header title={t("history.title")} profile={profile.data} />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "day", label: t("history.day") },
          { value: "week", label: t("history.week") },
          { value: "month", label: t("history.month") },
        ]}
        style={{ marginTop: 20, marginBottom: 17 }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 17 }}>
        <Pressable onPress={() => shift(-1)} accessibilityLabel={t("history.previous")} style={navButton}>
          <Text variant="title">‹</Text>
        </Pressable>
        <Text weight="semibold" onPress={() => setSelected(localISO())}>
          {periodLabel(selectedDate, mode, lang)}
        </Text>
        <Pressable onPress={() => shift(1)} accessibilityLabel={t("history.next")} style={navButton}>
          <Text variant="title">›</Text>
        </Pressable>
      </View>

      {mode !== "day" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}>
          {days.map((day) => {
            const iso = localISO(day);
            const active = iso === selected;
            const outside = mode === "month" && day.getMonth() !== selectedDate.getMonth();
            const hasWorkout = byDate.has(iso);
            const futurePlanned = !hasWorkout &&
              Boolean(scheduledWorkoutOn(profile.data?.training_schedule, iso));
            return (
              <Pressable
                key={iso}
                onPress={() => setSelected(iso)}
                accessibilityLabel={day.toLocaleDateString(lang, { weekday: "long", month: "long", day: "numeric" })}
                style={{
                  width: `${100 / 7}%`,
                  minHeight: mode === "week" ? 68 : 50,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radii.medium,
                  borderWidth: active ? 1 : 0,
                  borderColor: colors.lime,
                  backgroundColor: active ? "rgba(215,246,81,0.12)" : "transparent",
                  opacity: outside ? 0.35 : 1,
                }}
              >
                <Text variant="caption" tone="muted">
                  {day.toLocaleDateString(lang, { weekday: "short" }).slice(0, 1)}
                </Text>
                <Text weight={active ? "bold" : "regular"} tone={active ? "lime" : "primary"}>
                  {day.getDate()}
                </Text>
                {hasWorkout || futurePlanned ? (
                  <View style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    marginTop: 2,
                    borderWidth: futurePlanned ? 1 : 0,
                    borderColor: colors.lime,
                    backgroundColor: hasWorkout ? colors.lime : "transparent",
                  }} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {workouts.isLoading || profile.isLoading ? <LoadingState /> : null}
      {workouts.error ? <ErrorState message={workouts.error.message} retry={() => workouts.refetch()} /> : null}

      <View style={{ gap: 11 }}>
        {selectedWorkouts.map((workout) => (
          <WorkoutCard
            key={workout.id}
            workout={workout}
            unit={profile.data?.unit ?? "kg"}
            onPress={() => router.push({ pathname: "/workouts/[id]", params: { id: workout.id } })}
          />
        ))}
      </View>

      {planned ? (
        <Pressable onPress={() => router.push({ pathname: "/new", params: { type: planned.type, date: planned.date } })}>
          <Text variant="caption" tone="muted" style={{ marginTop: 10, marginBottom: 12 }}>
            {t("history.plannedDay")}
          </Text>
          <GradientCard variant="cherry" style={{ minHeight: 170 }}>
            <Text variant="micro" tone="muted">{t("history.scheduled")}</Text>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
              <DotValue value={selectedDate.getDate()} size={48} />
              <Text variant="title">{planned.type} ›</Text>
            </View>
          </GradientCard>
        </Pressable>
      ) : null}

      {!selectedWorkouts.length && !planned && !workouts.isLoading ? (
        <Card style={{ marginTop: 8, alignItems: "center" }}>
          <Text variant="title">{t("history.emptyTitle")}</Text>
          <Text tone="muted" style={{ marginTop: 4 }}>{t("history.emptyDay")}</Text>
        </Card>
      ) : null}

      <BottomSheet
        open={params.first === "1"}
        onClose={dismissFirstWorkoutSuccess}
        title={t("firstWorkout.savedTitle")}
        closeLabel={t("common.close")}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(215,246,81,0.13)",
            marginBottom: 18,
          }}
        >
          <Text tone="lime" style={{ fontSize: 30, lineHeight: 35 }}>✓</Text>
        </View>
        <Text tone="muted" style={{ marginBottom: 22 }}>{t("firstWorkout.savedBody")}</Text>
        <Button variant="lime" block onPress={dismissFirstWorkoutSuccess}>
          {t("firstWorkout.openHistory")}
        </Button>
      </BottomSheet>
    </Screen>
  );
}

const navButton = {
  width: 38,
  height: 38,
  borderRadius: 19,
  backgroundColor: colors.raised,
  justifyContent: "center" as const,
  alignItems: "center" as const,
};
