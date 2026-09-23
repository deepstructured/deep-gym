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
            <Text variant="micro" tone="muted">{formatDate(workout.date, lang)}</Text>
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
              <Text variant="micro" tone="muted">{t("workout.note")}</Text>
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
                      <Text variant="caption" tone="muted">
                        {entry.exercise ? t(`equipment.${entry.exercise.equipment}`) : ""}
                      </Text>
                    </View>
                    <Text tone="faint">›</Text>
                  </View>
                  {entry.notes ? <Text tone="muted" style={{ marginTop: 12 }}>{entry.notes}</Text> : null}
                  <View style={{ gap: 7, marginTop: 15 }}>
                    {entry.sets.map((set, setIndex) => {
                      const warmup = isWarmupSet(set);
                      const added = entry.load_mode === "bodyweight" && workout.body_weight_kg != null && set.weight_kg != null
                        ? roundWeight(kgToUnit(set.weight_kg - workout.body_weight_kg, unit))
                        : null;
                      return (
                        <View key={set.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, backgroundColor: colors.raised }}>
                          <Text variant="caption" tone="faint" style={{ width: 25 }}>{String(setIndex + 1).padStart(2, "0")}</Text>
                          {warmup ? <Text variant="micro" tone="pink">{t("set.warmupShort")}</Text> : null}
                          <Text style={{ flex: 1 }}>
                            {formatWeight(set.weight_kg, unit)} × {set.reps ?? "—"}
                            {added != null ? ` (${added >= 0 ? "+" : ""}${added} ${unit})` : ""}
                          </Text>
                          {set.to_failure ? <Text tone="pink">●</Text> : null}
                        </View>
                      );
                    })}
                  </View>
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
