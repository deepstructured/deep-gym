import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import type { Profile, Workout } from "@deepgym/core/types";
import { kgToUnit, roundWeight } from "@deepgym/core/weight";
import { translateCount } from "@deepgym/core/i18n";
import { avatarSource } from "../lib/avatar-source";
import { userErrorMessage } from "../lib/user-error";
import { colors, fonts, radii } from "../theme";
import { BrandMark, Card, Text } from "../ui";
import { useI18n } from "../providers/locale-provider";
import { formatDate, workingSetCount } from "./format";

export function Header({
  title,
  profile,
  back = false,
  action,
}: {
  title: string;
  profile?: Profile | null;
  back?: boolean;
  action?: React.ReactNode;
}) {
  const { t } = useI18n();
  const avatar = avatarSource(profile?.avatar_url ?? null);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 64, gap: 12 }}>
      {back ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel={t("common.back")}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.raised,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
      ) : (
        <BrandMark size={24} />
      )}
      <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      {action}
      {!back ? (
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityLabel={t("settings.title")}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.raised,
            borderWidth: 1,
            borderColor: colors.line,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Image source={avatar} style={{ width: 38, height: 38 }} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function LoadingState() {
  const { t } = useI18n();
  return (
    <View style={{ paddingVertical: 64, alignItems: "center", gap: 16 }}>
      <ActivityIndicator color={colors.lime} />
      <Text tone="muted">{t("common.loading")}</Text>
    </View>
  );
}

export function ErrorState({ message, retry, translated = false }: { message: string; retry?: () => void; translated?: boolean }) {
  const { t } = useI18n();
  return (
    <Pressable onPress={retry} disabled={!retry} style={{ paddingVertical: 36 }}>
      <Text tone="pink">{translated ? message : userErrorMessage(t, message)}</Text>
      {retry ? <Text tone="muted" style={{ marginTop: 8 }}>{t("common.retry")}</Text> : null}
    </Pressable>
  );
}

export function WorkoutCard({
  workout,
  unit = "kg",
  onPress,
}: {
  workout: Workout;
  unit?: "kg" | "lb";
  onPress?: () => void;
}) {
  const { t, lang } = useI18n();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button">
      <Card style={{ borderRadius: radii.tile }} padding={16}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text weight="bold" tone="lime" style={{ fontSize: 16 }}>{workout.type}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 3 }}>
              {formatDate(workout.date, lang)} · {translateCount(lang, "count.exercises", workout.workout_exercises.length)} · {translateCount(lang, "count.sets", workingSetCount(workout))}
            </Text>
          </View>
          {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.faint} /> : null}
        </View>
        {workout.notes ? <View style={{ marginTop: 12, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.raised, flexDirection: "row", alignItems: "flex-start", gap: 7 }}>
          <Ionicons name="document-text-outline" size={14} color={colors.muted} />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>{workout.notes}</Text>
        </View> : null}
        <View style={{ marginTop: 14, gap: 12 }}>
          {workout.workout_exercises.map((entry) => {
            const exerciseUnit = entry.exercise?.unit ?? unit;
            const bodyweight = entry.exercise?.equipment === "bodyweight" && workout.body_weight_kg != null;
            return <View key={entry.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text variant="body" weight="medium" numberOfLines={1} style={{ flex: 1 }}>{entry.exercise?.name ?? t("exercises.title")}</Text>
                {entry.exercise ? <View style={{ borderRadius: 999, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text variant="caption" tone="muted" style={{ fontSize: 10 }}>{t(`equipment.${entry.exercise.equipment}`)}</Text>
                </View> : null}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                {entry.sets.map((set) => {
                  const warmup = set.set_type === "warmup";
                  const load = set.weight_kg == null ? "—" : String(roundWeight(kgToUnit(set.weight_kg, exerciseUnit)));
                  const body = workout.body_weight_kg == null ? "" : String(roundWeight(kgToUnit(workout.body_weight_kg, exerciseUnit)));
                  const difference = set.weight_kg == null || workout.body_weight_kg == null ? 0 : roundWeight(kgToUnit(set.weight_kg - workout.body_weight_kg, exerciseUnit));
                  return <View key={set.id} style={{ borderRadius: 20, backgroundColor: warmup ? "rgba(24,39,136,0.2)" : colors.raised, borderWidth: 1, borderColor: warmup ? "rgba(64,84,214,0.3)" : colors.line, paddingHorizontal: 9, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {warmup ? <Text variant="caption" style={{ fontSize: 10, color: "#aeb8ff", fontFamily: fonts.bold }}>{t("set.warmupShort")}</Text> : null}
                    {bodyweight && set.weight_kg != null ? <Text variant="caption" style={{ fontFamily: fonts.dot }}>{body} <Text variant="caption" tone="faint">{difference >= 0 ? "+" : ""}</Text>{difference} <Text variant="caption" tone="faint">=</Text> {load}</Text>
                      : <Text variant="caption" style={{ fontFamily: fonts.dot }}>{load}</Text>}
                    {exerciseUnit !== unit || bodyweight ? <Text variant="caption" tone="faint" style={{ fontSize: 10 }}>{exerciseUnit}</Text> : null}
                    <Text variant="caption" tone="faint">×</Text>
                    <Text variant="caption" style={{ fontFamily: fonts.dot }}>{set.reps ?? "—"}</Text>
                    {set.to_failure ? <Ionicons name="flame" size={12} color={colors.flame} /> : null}
                  </View>;
                })}
              </View>
              {entry.notes ? <Text variant="caption" tone="faint">{entry.notes}</Text> : null}
            </View>;
          })}
        </View>
      </Card>
    </Pressable>
  );
}
