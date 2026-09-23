import { CURRENT_ONBOARDING_VERSION, CURRENT_RELEASE } from "@deepgym/core/releases";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

import { useProfile, useUpdateProfile } from "../data/queries";
import { supabase } from "../lib/supabase";
import { colors } from "../theme";
import { BottomSheet, BrandMark, Button, Card, GradientCard, Screen, Text } from "../ui";
import { useAuth } from "./auth-provider";
import { useI18n } from "./locale-provider";

/** Mirrors the web startup order: eligibility, onboarding, then release notes. */
export function ProductExperience({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ "preview-whats-new"?: string }>();
  const previewRelease = __DEV__ && params["preview-whats-new"] === "1";
  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();
  const [releaseDismissed, setReleaseDismissed] = useState(false);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const profile = profileQuery.data;
  const needsWorkoutCheck = Boolean(
    profile &&
      typeof profile.onboarding_version === "number" &&
      profile.onboarding_version < CURRENT_ONBOARDING_VERSION,
  );
  const workoutCountQuery = useQuery({
    queryKey: ["workouts", "count", user?.id],
    enabled: Boolean(user && needsWorkoutCheck),
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("workouts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      if (error) throw error;
      if (count == null) throw new Error("Workout count is unavailable");
      return count;
    },
  });
  const needsOnboarding =
    needsWorkoutCheck && workoutCountQuery.data === 0;

  useEffect(() => {
    setReleaseDismissed(false);
    setPreviewDismissed(false);
  }, [user?.id]);

  useEffect(() => {
    if (needsOnboarding) {
      router.replace({ pathname: "/onboarding", params: { next: pathname } });
    }
  }, [needsOnboarding, pathname]);

  if (needsWorkoutCheck && workoutCountQuery.isError) {
    return (
      <Screen scroll={false} contentStyle={{ justifyContent: "center", gap: 18 }}>
        <Card style={{ paddingVertical: 15 }}>
          <BrandMark size={36} />
          <Text style={{ marginTop: 16 }}>{t("onboarding.eligibilityError")}</Text>
          <Button
            variant="lime"
            block
            loading={workoutCountQuery.isFetching}
            onPress={() => void workoutCountQuery.refetch()}
            style={{ marginTop: 22 }}
          >
            {t("common.retry")}
          </Button>
        </Card>
      </Screen>
    );
  }

  if (
    profileQuery.isLoading ||
    (needsWorkoutCheck && workoutCountQuery.isLoading) ||
    needsOnboarding
  ) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.lime} />
      </View>
    );
  }

  const releasePending = Boolean(
    pathname === "/" &&
      profile &&
      typeof profile.last_seen_release_version === "number" &&
      profile.last_seen_release_version < CURRENT_RELEASE.sequence,
  );
  const showRelease = previewRelease
    ? !previewDismissed
    : releasePending && !releaseDismissed;

  function acknowledgeRelease() {
    if (previewRelease) {
      setPreviewDismissed(true);
      return;
    }
    setReleaseDismissed(true);
    updateProfile.mutate({ last_seen_release_version: CURRENT_RELEASE.sequence });
  }

  return (
    <>
      {children}
      <BottomSheet
        open={showRelease}
        onClose={acknowledgeRelease}
        title={t("whatsNew.title")}
        closeLabel={t("common.close")}
      >
        <GradientCard variant="indigo" padding={22}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <BrandMark size={31} />
            <Text variant="caption" tone="muted">{t("whatsNew.version", { version: CURRENT_RELEASE.label })}</Text>
          </View>
          <Text variant="title" style={{ marginTop: 28 }}>{t("whatsNew.releaseTitle")}</Text>
          <Text tone="muted" style={{ marginTop: 8 }}>{t("whatsNew.releaseBody")}</Text>
        </GradientCard>
        <View style={{ marginTop: 20, gap: 10 }}>
          {RELEASE_ITEMS.map((item) => (
            <Card key={item.title} radius={20} padding={16}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Ionicons name={item.icon} color={item.color} size={20} />
                <View style={{ flex: 1 }}>
                  <Text weight="semibold">{t(item.title)}</Text>
                  <Text tone="muted" variant="caption" style={{ marginTop: 4 }}>{t(item.body)}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
        <Button variant="lime" block size="lg" onPress={acknowledgeRelease} style={{ marginTop: 20 }}>
          {t("whatsNew.gotIt")}
        </Button>
      </BottomSheet>
    </>
  );
}

const RELEASE_ITEMS = [
  { title: "whatsNew.home.title", body: "whatsNew.home.body", icon: "grid-outline", color: colors.lime },
  { title: "whatsNew.progress.title", body: "whatsNew.progress.body", icon: "stats-chart-outline", color: colors.indigoBright },
  { title: "whatsNew.workout.title", body: "whatsNew.workout.body", icon: "flame-outline", color: colors.cherryBright },
  { title: "whatsNew.library.title", body: "whatsNew.library.body", icon: "library-outline", color: colors.indigoBright },
] as const;
