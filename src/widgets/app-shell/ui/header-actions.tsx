"use client";

import Link from "next/link";
import { useProfile } from "@/entities/user";
import { openCommandPalette } from "@/features/command-palette";
import { useActiveWorkoutDraft } from "@/features/workout-form";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { Avatar, IconPlus, IconSearch } from "@/shared/ui";
import { UiModeToggle } from "./ui-mode-toggle";
import styles from "./header-actions.module.scss";

/**
 * The global controls the desktop top bar carries now that navigation lives
 * in the dock: quick search, the interface-mode switch, the primary "log a
 * workout" action and the account shortcut. Hidden in the phone layout,
 * where each of these already has a home.
 */
export function HeaderActions({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  const { data: profile } = useProfile();
  const draft = useActiveWorkoutDraft();
  const inProgress = draft != null;

  return (
    <div className={styles.actions}>
      <button
        type="button"
        onClick={openCommandPalette}
        aria-label={t("palette.placeholder")}
        className={styles.search}
      >
        <IconSearch size={16} />
        <span className={styles.searchLabel}>{t("palette.placeholder")}</span>
        <kbd className={styles.kbd}>⌘K</kbd>
      </button>

      <UiModeToggle />

      {!compact && (
        <Link
          href="/workouts/new"
          className={cn(styles.start, inProgress && styles.startLive)}
        >
          <IconPlus size={17} />
          <span className={styles.startLabel}>
            {inProgress ? t("draft.continue") : t("home.startWorkout")}
          </span>
          {inProgress && <span className={styles.liveDot} />}
        </Link>
      )}

      <Link
        href="/settings"
        aria-label={t("nav.settings")}
        className={styles.account}
      >
        <Avatar
          src={profile?.avatar_url}
          size={32}
          alt={profile?.display_name ?? ""}
        />
      </Link>
    </div>
  );
}
