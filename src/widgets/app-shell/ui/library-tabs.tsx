"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { IconDumbbell, IconTemplate } from "@/shared/ui";
import styles from "./library-tabs.module.scss";

/** Exercises ⇄ Templates switcher at the top of the Library tab. Links
 *  replace history so the back gesture leaves the Library, not the tab. */
export function LibraryTabs() {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = [
    { href: "/exercises", label: t("exercises.title"), icon: IconDumbbell },
    { href: "/templates", label: t("templates.title"), icon: IconTemplate },
  ];

  return (
    <nav aria-label={t("nav.library")} className={styles.tabs}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            replace
            aria-current={active ? "page" : undefined}
            className={cn(styles.tab, active && styles.active)}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
