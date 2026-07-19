"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useProfile, useUpdateProfile } from "@/entities/user";
import { useWorkoutCount } from "@/entities/workout";
import { WhatsNewSheet } from "@/features/whats-new";
import {
  CURRENT_ONBOARDING_VERSION,
  CURRENT_RELEASE,
} from "@/shared/config/releases";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { BrandMark, Button, Spinner } from "@/shared/ui";
import styles from "./product-experience.module.scss";

const PUBLIC_PATHS = ["/login", "/offline", "/auth"];

export function ProductExperience({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();
  const [releaseDismissed, setReleaseDismissed] = useState(false);
  const [previewRelease, setPreviewRelease] = useState(false);
  const [previewDismissed, setPreviewDismissed] = useState(false);

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isOnboarding = pathname.startsWith("/onboarding");
  const profile = profileQuery.data;
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
    if (!needsOnboarding || isOnboarding) return;
    const search =
      typeof window === "undefined" ? "" : window.location.search;
    const next = pathname.startsWith("/") ? `${pathname}${search}` : "/";
    router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
  }, [isOnboarding, needsOnboarding, pathname, router]);

  const acknowledgeRelease = useCallback(() => {
    if (previewRelease) {
      setPreviewDismissed(true);
      return;
    }
    // Close first and persist best-effort. An offline write can make the
    // release reappear on the next app load, but never traps this session.
    setReleaseDismissed(true);
    updateProfile.mutate({
      last_seen_release_version: CURRENT_RELEASE.sequence,
    });
  }, [previewRelease, updateProfile]);

  if (isPublic || isOnboarding || profileQuery.isError) {
    return children;
  }

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
    return <ExperienceLoader />;
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
        : releasePending && !releaseDismissed),
  );

  return (
    <>
      {children}
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
}: {
  retrying: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  return (
    <main className={styles.errorMain}>
      <div className={cn(styles.errorCard, "surface-well")}>
        <div className={styles.errorGlyph}>
          <BrandMark width={36} />
        </div>
        <p role="alert" className={styles.errorText}>
          {t("onboarding.eligibilityError")}
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
      </div>
    </main>
  );
}

function ExperienceLoader() {
  return (
    <div className={styles.loader}>
      <div className={styles.loaderInner}>
        <BrandMark width={38} />
        <Spinner size={20} />
      </div>
    </div>
  );
}
