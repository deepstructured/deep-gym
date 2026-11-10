"use client";

import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useProfile, useUpdateProfile } from "@/entities/user";
import { useWorkoutCount } from "@/entities/workout";
import { WhatsNewSheet } from "@/features/whats-new";
import {
  CURRENT_ONBOARDING_VERSION,
  CURRENT_RELEASE,
} from "@/shared/config/releases";
import { useI18n, type MessageKey } from "@/shared/i18n";
import { resetLocalAuthSession, retryAuthSession, useAuthSession } from "@/shared/lib/auth-session";
import { cn } from "@/shared/lib/cn";
import { BrandMark, Button, PageLoader } from "@/shared/ui";
import styles from "./product-experience.module.scss";

const PUBLIC_PATHS = ["/login", "/offline", "/auth", "/privacy"];
const dismissedReleases = new Set<string>();

export function ProductExperience({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAuthSession();
  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();
  const [releaseDismissed, setReleaseDismissed] = useState(false);
  const [previewRelease, setPreviewRelease] = useState(false);
  const [previewDismissed, setPreviewDismissed] = useState(false);

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isOnboarding = pathname.startsWith("/onboarding");
  const profile = profileQuery.data;
  const releaseDismissalKey = `${session.userId}:${CURRENT_RELEASE.sequence}`;
  // Fail open during a staggered deploy: the UI becomes active only after the
  // migration-backed fields are actually present in the profile response.
  const hasOnboardingState =
    typeof profile?.onboarding_version === "number";
  const hasReleaseState =
    typeof profile?.last_seen_release_version === "number";
  const onboardingVersion = profile?.onboarding_version ?? 0;
  const needsWorkoutCheck = Boolean(
    profile &&
      hasOnboardingState &&
      onboardingVersion < CURRENT_ONBOARDING_VERSION,
  );
  const workoutCountQuery = useWorkoutCount(
    !isPublic && !isOnboarding && needsWorkoutCheck,
  );

  const needsOnboarding = Boolean(
    needsWorkoutCheck && workoutCountQuery.data === 0,
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const params = new URLSearchParams(window.location.search);
    setPreviewRelease(params.get("preview-whats-new") === "1");
  }, [pathname]);

  useEffect(() => {
    // A sign-out/sign-in transition can happen without remounting providers.
    // Dismissal belongs to one athlete's session, never the next profile.
    setReleaseDismissed(false);
    setPreviewDismissed(false);
  }, [profile?.id]);

  useEffect(() => {
    if (!needsOnboarding || isOnboarding || isPublic || session.status !== "authenticated") return;
    const search =
      typeof window === "undefined" ? "" : window.location.search;
    const next = pathname.startsWith("/") ? `${pathname}${search}` : "/";
    router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
  }, [isOnboarding, isPublic, needsOnboarding, pathname, router, session.status]);

  const acknowledgeRelease = useCallback(() => {
    if (previewRelease) {
      setPreviewDismissed(true);
      return;
    }
    // Close first and persist best-effort. An offline write can make the
    // release reappear on the next app load, but never traps this session.
    setReleaseDismissed(true);
    dismissedReleases.add(releaseDismissalKey);
    updateProfile.mutate({
      last_seen_release_version: CURRENT_RELEASE.sequence,
    });
  }, [previewRelease, releaseDismissalKey, updateProfile]);

  // A different athlete must get fresh component state as well as fresh data.
  const content = <Fragment key={session.userId ?? "signed-out"}>{children}</Fragment>;
  if (isPublic) return content;

  if (session.status === "loading") return <PageLoader fullscreen />;
  if (session.status === "error" || session.status === "unauthenticated") {
    return <EligibilityError
      message="auth.unavailableMessage"
      retrying={false}
      onRetry={retryAuthSession}
      backToLogin
    />;
  }
  if (profileQuery.isPending) return <PageLoader fullscreen />;
  if (!profile || profile.id !== session.userId) {
    return <EligibilityError
      message="auth.profileUnavailable"
      retrying={profileQuery.isFetching}
      onRetry={() => void profileQuery.refetch()}
      backToLogin
    />;
  }
  if (isOnboarding) return content;

  if (needsWorkoutCheck && workoutCountQuery.isError) {
    return (
      <EligibilityError
        retrying={workoutCountQuery.isFetching}
        onRetry={() => void workoutCountQuery.refetch()}
      />
    );
  }

  const resolvingEligibility =
    profileQuery.isLoading ||
    (needsWorkoutCheck && workoutCountQuery.isLoading);
  if (resolvingEligibility || needsOnboarding) {
    return <PageLoader fullscreen />;
  }

  const releasePending = Boolean(
    pathname === "/" &&
      profile &&
      hasReleaseState &&
      (profile.last_seen_release_version ?? 0) < CURRENT_RELEASE.sequence,
  );
  const showRelease = Boolean(
    !needsOnboarding &&
      (previewRelease
        ? !previewDismissed
        : releasePending && !releaseDismissed && !dismissedReleases.has(releaseDismissalKey)),
  );

  return (
    <>
      {content}
      <WhatsNewSheet
        open={showRelease}
        onClose={acknowledgeRelease}
      />
    </>
  );
}

function EligibilityError({
  retrying,
  onRetry,
  message = "onboarding.eligibilityError",
  backToLogin = false,
}: {
  retrying: boolean;
  onRetry: () => void;
  message?: MessageKey;
  backToLogin?: boolean;
}) {
  const { t } = useI18n();

  return (
    <main className={styles.errorMain}>
      <div className={cn(styles.errorCard, "surface-well")}>
        <div className={styles.errorGlyph}>
          <BrandMark width={36} />
        </div>
        <p role="alert" className={styles.errorText}>
          {t(message)}
        </p>
        <Button
          type="button"
          variant="lime"
          size="md"
          loading={retrying}
          block
          className={styles.retry}
          onClick={onRetry}
        >
          {t("common.retry")}
        </Button>
        {backToLogin && (
          <>
          <Button type="button" variant="ghost" block className={styles.retry}
            onClick={() => window.location.assign("/login")}>
            {t("common.backToLogin")}
          </Button>
          <Button type="button" variant="ghost" block onClick={resetLocalAuthSession}>
            {t("auth.resetLocalSession")}
          </Button>
          </>
        )}
      </div>
    </main>
  );
}
