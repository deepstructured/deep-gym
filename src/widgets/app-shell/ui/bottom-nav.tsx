"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveWorkoutDraft } from "@/features/workout-form";
import { useI18n, type MessageKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import {
  IconChart,
  IconHistory,
  IconHome,
  IconLibrary,
  IconPlus,
} from "@/shared/ui";
import styles from "./bottom-nav.module.scss";

/** Four destinations around the central "log a workout" action. Settings
 *  live behind the profile avatar; Library holds exercises and templates. */
const tabs: {
  href: string;
  labelKey: MessageKey;
  icon: typeof IconHome;
  primary?: boolean;
  /** Extra route prefixes that keep the tab highlighted. */
  alsoActive?: string[];
}[] = [
  { href: "/", labelKey: "nav.home", icon: IconHome },
  { href: "/history", labelKey: "nav.history", icon: IconHistory },
  { href: "/workouts/new", labelKey: "nav.add", icon: IconPlus, primary: true },
  { href: "/progress", labelKey: "nav.progress", icon: IconChart },
  {
    href: "/exercises",
    labelKey: "nav.library",
    icon: IconLibrary,
    alsoActive: ["/templates"],
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const draft = useActiveWorkoutDraft();

  return (
    <nav className={styles.nav}>
      <div className={styles.tabs}>
        {tabs.map(({ href, labelKey, icon: Icon, primary, alsoActive }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : [href, ...(alsoActive ?? [])].some((prefix) =>
                  pathname.startsWith(prefix),
                );
          const label = t(labelKey);

          if (primary) {
            const inProgress = draft != null;
            return (
              <Link
                key={href}
                href={href}
                aria-label={inProgress ? t("draft.continue") : label}
                className={cn(styles.primary, inProgress && styles.primaryLive)}
              >
                <Icon size={26} />
                {inProgress && <span className={styles.liveDot} />}
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={cn(styles.tab, active && styles.tabActive)}
            >
              <Icon size={22} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
