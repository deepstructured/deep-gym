import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { scheduledWorkoutOn } from "@deepgym/core/next-workout";
import { colors, fonts, radii } from "../theme";
import { BottomSheet, Button, Screen, Segmented, Text } from "../ui";
import { useProfile, useWorkouts } from "../data/queries";
import { useI18n } from "../providers/locale-provider";
import { fromISO, localISO } from "./format";
import { ErrorState, Header, LoadingState, WorkoutCard } from "./common";
import { ScheduledWorkoutCard } from "./scheduled-workout-card";

type ViewMode = "day" | "week" | "month";

function validDateParam(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try {
    return localISO(fromISO(value)) === value ? value : null;
  } catch {
    return null;
  }
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

function PlannedDot({ size = 6 }: { size?: number }) {
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 1,
      borderColor: colors.cherry,
      backgroundColor: "rgba(211,79,61,0.1)",
    }} />
  );
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
    // Count calendar dates, not elapsed milliseconds (which differ across DST).
    const length = Math.ceil((((first.getDay() + 6) % 7) + last.getDate()) / 7) * 7;
    return Array.from({ length }, (_, index) => addDays(start, index));
  }, [selected, mode]);
  const calendarRows = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) =>
    days.slice(index * 7, index * 7 + 7));
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
  const hasPlannedDates = mode !== "day" && days.some((day) => {
    const iso = localISO(day);
    if (mode === "month" && day.getMonth() !== selectedDate.getMonth()) return false;
    return !byDate.has(iso) && scheduledWorkoutOn(profile.data?.training_schedule, iso) != null;
  });
  const todayISO = localISO();

  function shift(direction: number) {
    const next = new Date(selectedDate);
    if (mode === "month") {
      // Clamp the date so navigating from the 31st cannot skip a short month.
      const day = next.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
    }
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
          <Ionicons name="chevron-back" size={18} color={colors.muted} />
        </Pressable>
        <Pressable onPress={() => setSelected(localISO())} accessibilityRole="button" style={{ paddingHorizontal: 12, paddingVertical: 6, flexShrink: 1 }}>
          <Text weight="semibold" style={{ textAlign: "center" }}>{periodLabel(selectedDate, mode, lang)}</Text>
        </Pressable>
        <Pressable onPress={() => shift(1)} accessibilityLabel={t("history.next")} style={navButton}>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </View>

      {mode !== "day" ? (
        <View style={{ marginBottom: 20 }}>
          {mode === "month" ? (
            <View style={{ flexDirection: "row", columnGap: 4, marginBottom: 4 }}>
              {days.slice(0, 7).map((day) => (
                <Text key={localISO(day)} style={{ flex: 1, minWidth: 0, textAlign: "center", color: colors.faint, fontSize: 10, lineHeight: 15, fontFamily: fonts.medium }}>
                  {day.toLocaleDateString(lang, { weekday: "narrow" }).toLocaleUpperCase(lang)}
                </Text>
              ))}
            </View>
          ) : null}
          <View style={{ rowGap: mode === "week" ? 0 : 4 }}>
            {calendarRows.map((row) => (
              <View key={localISO(row[0])} style={{ flexDirection: "row", columnGap: mode === "week" ? 6 : 4 }}>
                {row.map((day) => {
                  const iso = localISO(day);
                  const active = iso === selected;
                  const today = iso === todayISO;
                  const outside = mode === "month" && day.getMonth() !== selectedDate.getMonth();
                  const count = outside ? 0 : (byDate.get(iso) ?? 0);
                  const futurePlanned = count === 0 && !outside &&
                    scheduledWorkoutOn(profile.data?.training_schedule, iso) != null;
                  return (
                    <Pressable
                      key={iso}
                      onPress={() => setSelected(iso)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={day.toLocaleDateString(lang, { weekday: "long", month: "long", day: "numeric" })}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: mode === "week" ? 76 : undefined,
                        aspectRatio: mode === "month" ? 1 : undefined,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: mode === "week" ? 4 : 2,
                        borderRadius: mode === "week" ? radii.tile : radii.small,
                        borderWidth: 1,
                        borderColor: active ? "rgba(215,246,81,0.6)" : today ? colors.faint : mode === "week" ? colors.line : "transparent",
                        backgroundColor: active ? "rgba(215,246,81,0.1)" : mode === "week" || count > 0 && !today ? colors.surface : "transparent",
                      }}
                    >
                      {mode === "week" ? (
                        <Text style={{ color: colors.faint, fontFamily: fonts.medium, fontSize: 10, lineHeight: 13 }}>
                          {day.toLocaleDateString(lang, { weekday: "narrow" }).toLocaleUpperCase(lang)}
                        </Text>
                      ) : null}
                      <Text style={{
                        fontFamily: fonts.dot,
                        fontSize: mode === "week" ? 18 : 14,
                        lineHeight: mode === "week" ? 20 : 18,
                        color: outside ? "rgba(92,92,100,0.5)" : active && mode === "week" ? colors.lime : colors.text,
                      }}>
                        {day.getDate()}
                      </Text>
                      <View style={{ height: 6, flexDirection: "row", alignItems: "center", gap: 2 }}>
                        {count > 0
                          ? Array.from({ length: mode === "month" ? Math.min(count, 3) : 1 }, (_, index) => (
                            <View key={index} style={{ width: mode === "week" ? 6 : 4, height: mode === "week" ? 6 : 4, borderRadius: 3, backgroundColor: colors.lime }} />
                          ))
                          : futurePlanned ? <PlannedDot /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          {hasPlannedDates ? (
            <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6, marginTop: 8 }}>
              <PlannedDot />
              <Text style={{ color: colors.faint, fontSize: 10, lineHeight: 14 }}>{t("history.plannedMarker")}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {workouts.isLoading || profile.isLoading ? <LoadingState /> : null}
      {workouts.error ? <ErrorState message={workouts.error.message} retry={() => workouts.refetch()} /> : null}

      <View style={{ gap: 16 }}>
        {mode !== "day" && selectedWorkouts.length > 0 ? (
          <Text weight="medium" tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>
            {periodLabel(selectedDate, "day", lang)}
          </Text>
        ) : null}
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
        <View style={{ paddingTop: 12, gap: 12 }}>
          <Text tone="muted" style={{ maxWidth: 256, alignSelf: "center", textAlign: "center", fontSize: 14, lineHeight: 23 }}>
            {t(selected === todayISO ? "history.todayPlanned" : "history.plannedDay")}
          </Text>
          <ScheduledWorkoutCard prediction={planned} label={t("history.scheduled")} />
        </View>
      ) : null}

      {!selectedWorkouts.length && !planned && !workouts.isLoading && !workouts.error ? (
        <View style={{ alignItems: "center", paddingVertical: 48, gap: 8 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", flexDirection: "row", flexWrap: "wrap", marginBottom: 8, opacity: 0.4 }}>
            {Array.from({ length: 25 }, (_, index) => (
              <View key={index} style={{ width: 12.8, height: 12.8, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.16)" }} />
              </View>
            ))}
          </View>
          <Text weight="medium">{t("history.emptyTitle")}</Text>
          <Text tone="muted" style={{ maxWidth: 240, textAlign: "center", fontSize: 14, lineHeight: 20 }}>{t("history.emptyDay")}</Text>
        </View>
      ) : null}

      <BottomSheet
        open={params.first === "1"}
        onClose={dismissFirstWorkoutSuccess}
        title={t("firstWorkout.savedTitle")}
        closeLabel={t("common.close")}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(215,246,81,0.25)",
            backgroundColor: "rgba(215,246,81,0.1)",
            marginBottom: 20,
          }}
        >
          <Ionicons name="checkmark" size={26} color={colors.lime} />
        </View>
        <Text tone="muted" style={{ fontSize: 15, lineHeight: 24 }}>{t("firstWorkout.savedBody")}</Text>
        <Button variant="lime" size="lg" block style={{ marginTop: 24 }} onPress={dismissFirstWorkoutSuccess}>
          {t("firstWorkout.openHistory")}
        </Button>
      </BottomSheet>
    </Screen>
  );
}

const navButton = {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: colors.raised,
  justifyContent: "center" as const,
  alignItems: "center" as const,
};
