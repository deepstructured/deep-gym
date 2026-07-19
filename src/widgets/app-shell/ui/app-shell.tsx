"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { BrandMark, IconChevronLeft } from "@/shared/ui";
import { BottomNav } from "./bottom-nav";
import styles from "./app-shell.module.scss";

interface AppShellProps {
  title?: string;
  back?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Hide the bottom tab bar (e.g. on full-screen forms). */
  hideNav?: boolean;
  className?: string;
}

export function AppShell({
  title,
  back,
  action,
  children,
  hideNav,
  className,
}: AppShellProps) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className={styles.shell}>
      {(title || back || action) && (
        <header className={styles.header}>
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
        </header>
      )}
      <div className={cn(styles.content, className)}>{children}</div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
