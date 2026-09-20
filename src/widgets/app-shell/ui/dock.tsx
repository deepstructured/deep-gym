"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n, type MessageKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import {
  IconChart,
  IconHistory,
  IconHome,
  IconLibrary,
  IconSettings,
} from "@/shared/ui";
import styles from "./dock.module.scss";

interface DockItem {
  href: string;
  labelKey: MessageKey;
  icon: typeof IconHome;
  /** Extra route prefixes that keep the item highlighted. */
  alsoActive?: string[];
  /** Start a new group — a hairline divider is drawn before it. */
  group?: boolean;
}

/** The same five destinations as the phone tab bar, so one mental model
 *  serves both layouts. Logging a workout is the header's primary button,
 *  the way "Create portfolio" sits in a top bar rather than in the dock. */
const ITEMS: DockItem[] = [
  { href: "/", labelKey: "nav.home", icon: IconHome },
  { href: "/history", labelKey: "nav.history", icon: IconHistory },
  { href: "/progress", labelKey: "nav.progress", icon: IconChart },
  {
    href: "/exercises",
    labelKey: "nav.library",
    icon: IconLibrary,
    alsoActive: ["/templates"],
  },
  { href: "/settings", labelKey: "nav.settings", icon: IconSettings, group: true },
];

/**
 * Floating desktop navigation, centred at the bottom of the window. Replaces
 * the left sidebar: with only five destinations it costs no discoverability
 * and gives every screen the full window width. Hidden by CSS in the phone
 * layout, which keeps its own tab bar.
 */
export function Dock() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav aria-label={t("nav.home")} className={styles.dock}>
      {ITEMS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : [item.href, ...(item.alsoActive ?? [])].some((prefix) =>
                pathname.startsWith(prefix),
              );
        const Icon = item.icon;
        const label = t(item.labelKey);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            data-label={label}
            className={cn(
              styles.item,
              active && styles.itemActive,
              item.group && styles.itemGrouped,
            )}
          >
            <Icon size={19} />
          </Link>
        );
      })}
    </nav>
  );
}
