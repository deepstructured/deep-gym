"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n, type MessageKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import {
  IconDumbbell,
  IconHistory,
  IconHome,
  IconPlus,
  IconSettings,
} from "@/shared/ui";
import styles from "./bottom-nav.module.scss";

const tabs: {
  href: string;
  labelKey: MessageKey;
  icon: typeof IconHome;
  primary?: boolean;
}[] = [
  { href: "/", labelKey: "nav.home", icon: IconHome },
  { href: "/history", labelKey: "nav.history", icon: IconHistory },
  { href: "/workouts/new", labelKey: "nav.add", icon: IconPlus, primary: true },
  { href: "/exercises", labelKey: "nav.exercises", icon: IconDumbbell },
  { href: "/settings", labelKey: "nav.settings", icon: IconSettings },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className={styles.nav}>
      <div className={styles.tabs}>
        {tabs.map(({ href, labelKey, icon: Icon, primary }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          const label = t(labelKey);

          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={styles.primary}
              >
                <Icon size={26} />
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
