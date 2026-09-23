import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, View } from "react-native";
import { isWarmupSet } from "@deepgym/core/workout";
import { translateCount } from "@deepgym/core/i18n";
import { formatWeight, kgToUnit, roundWeight } from "@deepgym/core/weight";
import { colors } from "../theme";
import { Button, Card, DotValue, GradientCard, Screen, Text } from "../ui";
import { useDeleteWorkout, useProfile, useWorkout } from "../data/queries";
import { useI18n } from "../providers/locale-provider";
import { userErrorMessage } from "../lib/user-error";
import { ErrorState, Header, LoadingState } from "./common";
import { formatDate, workingSetCount, workoutVolumeKg } from "./format";

export function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const profile = useProfile();
  const query = useWorkout(id ?? "");
  const remove = useDeleteWorkout();
  const workout = query.data;
  const defaultUnit = profile.data?.unit ?? "kg";

  function confirmDelete() {
    if (!workout) return;
    Alert.alert(t("workout.deleteTitle"), t("workout.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("workout.delete"),
        style: "destructive",
        onPress: () => remove.mutate(workout.id, {
          onSuccess: () => router.replace("/history"),
          onError: (error) => Alert.alert(t("common.error"), userErrorMessage(t, error)),
        }),
      },
    ]);
  }

  return (
    <Screen bottomPadding={44}>
      <Header
        title={workout?.type ?? t("history.title")}
        back
        action={workout ? (
          <Button variant="surface" size="sm" onPress={() => router.push({ pathname: "/workouts/[id]/edit", params: { id: workout.id } })}>
            {t("workout.edit")}
          </Button>
        ) : null}
      />
      {query.isLoading ? <LoadingState /> : null}
      {query.error ? <ErrorState message={query.error.message} retry={() => query.refetch()} /> : null}
      {!query.isLoading && !query.error && !workout ? (
        <ErrorState message={t("workout.notFound")} translated />
      ) : null}
      {workout ? (
        <View style={{ gap: 14, paddingTop: 16 }}>
          <GradientCard variant="pink" style={{ minHeight: 152 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Ionicons name="calendar-outline" size={15} color={colors.muted} />
              <Text variant="micro" tone="muted">{formatDate(workout.date, lang)}</Text>
            </View>
            <Text variant="display" style={{ marginTop: 16 }}>{workout.type}</Text>
            <Text tone="muted" style={{ marginTop: 6 }}>
              {translateCount(lang, "count.exercises", workout.workout_exercises.length)}
            </Text>
          </GradientCard>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Card variant="stat" style={{ flex: 1 }} padding={16}>
              <Text variant="micro" tone="muted">{t("progress.sets")}</Text>
              <DotValue value={workingSetCount(workout)} size={31} color={colors.lime} />
            </Card>
            <Card variant="stat" style={{ flex: 1 }} padding={16}>
              <Text variant="micro" tone="muted">{t("stats.metric.volume")}</Text>
              <DotValue value={formatWeight(workoutVolumeKg(workout), defaultUnit)} size={26} color={colors.pink} />
            </Card>
          </View>

          {workout.body_weight_kg != null ? (
            <Card variant="raised" radius={18} padding={16}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text tone="muted">{t("bodyWeight.title")}</Text>
                <Text weight="semibold">{formatWeight(workout.body_weight_kg, defaultUnit)}</Text>
              </View>
            </Card>
          ) : null}

          {workout.notes ? (
            <Card radius={18} padding={16}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Ionicons name="document-text-outline" size={17} color={colors.muted} />
                <Text variant="micro" tone="muted">{t("workout.note")}</Text>
              </View>
              <Text style={{ marginTop: 8 }}>{workout.notes}</Text>
            </Card>
          ) : null}

          <Text variant="micro" tone="muted" style={{ marginTop: 15 }}>
            {t("templates.exercises")}
          </Text>
          {workout.workout_exercises.map((entry, index) => {
            const unit = entry.exercise?.unit ?? defaultUnit;
            return (
              <Pressable
                key={entry.id}
                onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: entry.exercise_id } })}
              >
                <Card radius={20} padding={17}>
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <Text tone="lime" variant="micro">{String(index + 1).padStart(2, "0")}</Text>
                    <View style={{ flex: 1 }}>
                      <Text variant="title">{entry.exercise?.name ?? t("exercises.title")}</Text>
                      {entry.exercise ? (
                        <View style={{ alignSelf: "flex-start", marginTop: 7, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }}>
                          <Text variant="micro" tone="muted">{t(`equipment.${entry.exercise.equipment}`)}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 15 }}>
                    {entry.sets.map((set, setIndex) => {
                      const warmup = isWarmupSet(set);
                      const added = entry.load_mode === "bodyweight" && workout.body_weight_kg != null && set.weight_kg != null
                        ? roundWeight(kgToUnit(set.weight_kg - workout.body_weight_kg, unit))
                        : null;
                      return (
                        <View key={set.id} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: warmup ? "rgba(64,84,214,0.35)" : colors.line, backgroundColor: warmup ? "rgba(24,39,136,0.2)" : colors.raised }}>
                          {warmup ? <Text variant="micro" tone="white" style={{ marginRight: 1 }}>{t("set.warmupShort")}</Text> : null}
                          {added != null && workout.body_weight_kg != null ? (
                            <Text variant="caption">
                              {roundWeight(kgToUnit(workout.body_weight_kg, unit))} {added >= 0 ? "+" : ""}{added} = {formatWeight(set.weight_kg, unit)}
                            </Text>
                          ) : <Text variant="caption">{formatWeight(set.weight_kg, unit)}</Text>}
                          <Text variant="caption" tone="faint">×</Text>
                          <Text variant="caption">{set.reps ?? "—"}</Text>
                          {set.to_failure ? <Ionicons name="flame" size={13} color={colors.flameText} style={{ marginLeft: 2 }} /> : null}
                        </View>
                      );
                    })}
                  </View>
                  {entry.notes ? (
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 13 }}>
                      <Ionicons name="document-text-outline" size={15} color={colors.muted} style={{ marginTop: 2 }} />
                      <Text tone="muted" style={{ flex: 1 }}>{entry.notes}</Text>
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            );
          })}

          <Button variant="danger" size="lg" block loading={remove.isPending} onPress={confirmDelete} style={{ marginTop: 15 }}>
            {t("workout.delete")}
          </Button>
        </View>
      ) : null}
    </Screen>
  );
}
