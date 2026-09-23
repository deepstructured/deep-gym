import { router } from "expo-router";
import { Pressable, View } from "react-native";
import type { ScheduledWorkout } from "@deepgym/core/next-workout";
import { useI18n } from "../providers/locale-provider";
import { colors } from "../theme";
import { DotValue, GradientCard, Text } from "../ui";
import { fromISO, localISO } from "./format";
import { HomeTileIcon } from "./home-tile-icons";

/** The same calendar, date and week strip used by the PWA on Home and History. */
export function ScheduledWorkoutCard({ prediction, label }: { prediction: ScheduledWorkout; label?: string }) {
  const { t, lang } = useI18n();
  const date = fromISO(prediction.date);
  const when = prediction.daysAway === 0
    ? t("home.today")
    : prediction.daysAway === 1
      ? t("home.tomorrow")
      : date.toLocaleDateString(lang, { weekday: "long" });
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (date.getDay() + 6) % 7);
  const week = Array.from({ length: 7 }, (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index));
  return <Pressable onPress={() => router.push({ pathname: "/new", params: { type: prediction.type, date: prediction.date } })} accessibilityRole="button">
    <GradientCard variant="cherry" style={{ minHeight: 176 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
          <HomeTileIcon name="calendar" size={18} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="micro" tone="muted">{label ?? t("home.nextWorkout")}</Text>
          <Text tone={prediction.daysAway === 0 ? "lime" : "primary"} weight="medium" style={{ fontSize: 14, marginTop: 2 }}>{when}</Text>
        </View>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
          <HomeTileIcon name="chevron" size={18} color="#170c0b" />
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <DotValue value={date.getDate()} size={46} />
          <Text variant="caption" tone="muted" weight="medium" style={{ paddingBottom: 6, textTransform: "uppercase" }}>{date.toLocaleDateString(lang, { month: "short" })}</Text>
        </View>
        <View style={{ alignItems: "flex-end", paddingBottom: 4, maxWidth: "50%" }}>
          <Text variant="micro" tone="muted">{date.toLocaleDateString(lang, { weekday: "long" })}</Text>
          <Text variant="title" numberOfLines={1}>{prediction.type}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)", marginTop: 16, paddingTop: 12, gap: 8 }}>
        {week.map((day) => {
          const active = localISO(day) === prediction.date;
          return <View key={localISO(day)} style={{ flex: 1, alignItems: "center", gap: 7 }}>
            <Text variant="micro" tone={active ? "white" : "muted"} style={{ fontSize: 9, letterSpacing: 0 }}>{day.toLocaleDateString(lang, { weekday: "narrow" })}</Text>
            <View style={{ width: active ? 16 : 6, height: 6, borderRadius: 4, backgroundColor: active ? colors.lime : "rgba(255,255,255,0.26)" }} />
          </View>;
        })}
      </View>
    </GradientCard>
  </Pressable>;
}
