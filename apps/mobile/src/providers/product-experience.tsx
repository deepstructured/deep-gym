import { CURRENT_ONBOARDING_VERSION, CURRENT_RELEASE } from "@deepgym/core/releases";
import { useQuery } from "@tanstack/react-query";
import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";

import { useProfile, useUpdateProfile } from "../data/queries";
import { supabase } from "../lib/supabase";
import { BrandMark, Button, Card, Screen, Text } from "../ui";
import { ReleaseNotesSheet } from "../ui/release-notes-sheet";
import { useAuth } from "./auth-provider";
import { useI18n } from "./locale-provider";
import { SessionLoading } from "./session-loading";

/** Mirrors the web startup order: eligibility, onboarding, then release notes. */
export function ProductExperience({ children }: { children: ReactNode }) {
  const { user, resetLocalSession } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ "preview-whats-new"?: string }>();
  const previewRelease = __DEV__ && params["preview-whats-new"] === "1";
  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();
  const [releaseDismissed, setReleaseDismissed] = useState(false);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [resettingSession, setResettingSession] = useState(false);
  const [sessionResetError, setSessionResetError] = useState(false);
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

  if (profileQuery.isError && !profile) {
    return (
      <Screen scroll={false} contentStyle={{ justifyContent: "center", gap: 18 }}>
        <Card style={{ paddingVertical: 15 }}>
          <BrandMark size={36} />
          <Text style={{ marginTop: 16 }}>{t("auth.profileUnavailable")}</Text>
          <Button
            variant="lime"
            block
            loading={profileQuery.isFetching}
            onPress={() => void profileQuery.refetch()}
            style={{ marginTop: 22 }}
          >
            {t("common.retry")}
          </Button>
          <Button
            variant="surface"
            block
            loading={resettingSession}
            onPress={() => {
              setResettingSession(true);
              setSessionResetError(false);
              void resetLocalSession().catch(() => {
                setSessionResetError(true);
                setResettingSession(false);
              });
            }}
            style={{ marginTop: 10 }}
          >
            {t("auth.resetLocalSession")}
          </Button>
          {sessionResetError ? <Text tone="pink" style={{ marginTop: 12 }}>{t("common.error")}</Text> : null}
        </Card>
      </Screen>
    );
  }

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
    return <SessionLoading />;
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
      <ReleaseNotesSheet open={showRelease} onClose={acknowledgeRelease} />
    </>
  );
}
