import { router } from "expo-router";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import type { Profile, Workout } from "@deepgym/core/types";
import { formatWeight } from "@deepgym/core/weight";
import { translateCount } from "@deepgym/core/i18n";
import { avatarSource } from "../lib/avatar-source";
import { userErrorMessage } from "../lib/user-error";
import { colors, radii } from "../theme";
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
          <Text variant="title">‹</Text>
        </Pressable>
      ) : (
        <BrandMark size={20} />
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
      <Card style={{ borderRadius: radii.tile }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="title">{workout.type}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 3 }}>
              {formatDate(workout.date, lang)} · {translateCount(lang, "count.exercises", workout.workout_exercises.length)} · {translateCount(lang, "count.sets", workingSetCount(workout))}
            </Text>
          </View>
          {onPress ? <Text tone="faint">›</Text> : null}
        </View>
        <View style={{ marginTop: 14, gap: 10 }}>
          {workout.workout_exercises.slice(0, 4).map((entry) => (
            <View key={entry.id} style={{ gap: 4 }}>
              <Text variant="body" numberOfLines={1}>{entry.exercise?.name ?? t("exercises.title")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                {entry.sets.slice(0, 4).map((set) => (
                  <View
                    key={set.id}
                    style={{
                      borderRadius: 20,
                      backgroundColor: colors.raised,
                      borderWidth: 1,
                      borderColor: colors.line,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <Text variant="caption" tone="muted">
                      {formatWeight(set.weight_kg, unit)} × {set.reps ?? "—"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}
