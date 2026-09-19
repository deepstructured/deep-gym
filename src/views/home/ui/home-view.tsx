"use client";

import Link from "next/link";
import { useState } from "react";
import { useProfile } from "@/entities/user";
import { useWorkoutCount } from "@/entities/workout";
import { FirstWorkoutGuideCard } from "@/features/first-workout";
import { useI18n } from "@/shared/i18n";
import { formatDayFull, todayISO } from "@/shared/lib/dates";
import { AppShell } from "@/widgets/app-shell";
import { HomeDashboard } from "@/widgets/home-dashboard";
import { cn } from "@/shared/lib/cn";
import { Avatar, BrandMark, IconWidgets } from "@/shared/ui";
import styles from "./home-view.module.scss";

export function HomeView() {
  const { t } = useI18n();
  const { data: profile } = useProfile();
  const { data: workoutCount } = useWorkoutCount();
  const firstName = profile?.display_name?.split(" ")[0] ?? t("home.athlete");
  const [editing, setEditing] = useState(false);

  return (
    <AppShell>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.dateRow}>
            <BrandMark width={22} />
            <p className={styles.date}>{formatDayFull(todayISO())}</p>
          </div>
          <h1 className={styles.greeting}>
            {t("home.greeting", { name: firstName })}
          </h1>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            aria-label={t("dashboard.customize")}
            aria-pressed={editing}
            onClick={() => setEditing(!editing)}
            className={cn(styles.customize, editing && styles.customizeOn)}
          >
            <IconWidgets size={19} />
          </button>
          <Link
            href="/settings"
            aria-label={t("nav.settings")}
            className={styles.avatarLink}
          >
            <Avatar
              src={profile?.avatar_url}
              size={46}
              alt={profile?.display_name ?? ""}
            />
          </Link>
        </div>
      </header>

      {workoutCount === 0 && (
        <div className={styles.guide}>
          <FirstWorkoutGuideCard />
        </div>
      )}

      <HomeDashboard editing={editing} onEditingChange={setEditing} />
    </AppShell>
  );
}
