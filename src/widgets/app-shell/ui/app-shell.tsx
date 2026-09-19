"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProfile } from "@/entities/user";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { Avatar, BrandMark, IconChevronLeft } from "@/shared/ui";
import { BottomNav } from "./bottom-nav";
import styles from "./app-shell.module.scss";

interface AppShellProps {
  title?: string;
  back?: boolean;
  action?: React.ReactNode;
  /** Top-level tabs show the profile avatar — the way into Settings. */
  account?: boolean;
  /** Content pinned under the header row (e.g. the Library switcher). */
  subheader?: React.ReactNode;
  children: React.ReactNode;
  /** Hide the bottom tab bar (e.g. on full-screen forms). */
  hideNav?: boolean;
  className?: string;
}

export function AppShell({
  title,
  back,
  action,
  account,
  subheader,
  children,
  hideNav,
  className,
}: AppShellProps) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className={styles.shell}>
      {(title || back || action || account) && (
        <header className={styles.header}>
          <div className={styles.headerRow}>
            {back && (
              <button
                type="button"
                onClick={() => router.back()}
                aria-label={t("common.back")}
                className={styles.back}
              >
                <IconChevronLeft size={20} />
              </button>
            )}
            {!back && title && <BrandMark width={24} />}
            {title && <h1 className={styles.title}>{title}</h1>}
            {action && <div className={styles.action}>{action}</div>}
            {account && <AccountButton />}
          </div>
          {subheader}
        </header>
      )}
      <div className={cn(styles.content, className)}>{children}</div>
      {!hideNav && <BottomNav />}
    </div>
  );
}

/** Avatar shortcut to Settings. */
export function AccountButton({ size = 34 }: { size?: number }) {
  const { t } = useI18n();
  const { data: profile } = useProfile();
  return (
    <Link
      href="/settings"
      aria-label={t("nav.settings")}
      className={styles.account}
    >
      <Avatar
        src={profile?.avatar_url}
        size={size}
        alt={profile?.display_name ?? ""}
      />
    </Link>
  );
}
