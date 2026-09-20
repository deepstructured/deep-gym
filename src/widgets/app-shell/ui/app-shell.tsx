"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProfile } from "@/entities/user";
import { CommandPalette } from "@/features/command-palette";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { Avatar, BrandMark, IconChevronLeft } from "@/shared/ui";
import { BottomNav } from "./bottom-nav";
import { Dock } from "./dock";
import { HeaderActions } from "./header-actions";
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
  /** Contextual desktop panel, shown as a right rail from 1440px up. Below
   *  that it is not rendered at all, so views must not put anything
   *  essential in it. */
  aside?: React.ReactNode;
  /** Let the desktop content span the full width instead of the reading
   *  column — for tables and multi-pane views. */
  wide?: boolean;
  className?: string;
}

/**
 * One DOM tree for both layouts. The phone shell (bottom tab bar, 28rem
 * column) and the desktop shell (top bar + floating dock) are switched
 * purely by CSS on `html[data-ui]`, which the inline script in
 * app/layout.tsx sets before the first paint — so there is no flash and no
 * hydration branch. See src/shared/lib/ui-mode.ts.
 */
export function AppShell({
  title,
  back,
  action,
  account,
  subheader,
  children,
  hideNav,
  aside,
  wide,
  className,
}: AppShellProps) {
  const router = useRouter();
  const { t } = useI18n();
  const hasHeader = Boolean(title || back || action || account);
  // The phone header only carried the brand on a top-level titled screen;
  // the desktop top bar always does, the way the reference keeps its
  // workspace badge pinned top-left.
  const markOnPhone = !back && Boolean(title);

  return (
    <div className={cn(styles.shell, subheader && styles.withSubheader)}>
      {/* A direct child of the shell, not of the content column: the desktop
          top bar spans the window while the content below stays in its
          reading column. Always rendered, because on a view with no page
          chrome of its own (Home) it still carries the global actions; CSS
          hides it in the phone layout when there is nothing to show. */}
      <header
        className={cn(styles.header, !hasHeader && styles.headerGlobalOnly)}
      >
        <div className={styles.headerInner}>
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
            <BrandMark
              width={24}
              className={cn(styles.mark, !markOnPhone && styles.markDesktop)}
            />
            {title && <h1 className={styles.title}>{title}</h1>}
            {!title && <span className={styles.spacer} />}
            {action && <div className={styles.action}>{action}</div>}
            {/* A view with its own primary action does not also need the
                global "log a workout" button — on the workout form it would
                link to the page you are already on. */}
            <HeaderActions compact={Boolean(action)} />
            {account && <AccountButton />}
          </div>
          {subheader}
        </div>
      </header>

      {/* Content and the contextual rail share a wrapper so the top bar can
          span the window edge to edge above them. */}
      <div className={styles.body}>
        <div className={cn(styles.main, wide && styles.mainWide)}>
          <div className={cn(styles.content, className)}>{children}</div>
        </div>

        {aside && <aside className={styles.rail}>{aside}</aside>}
      </div>

      {!hideNav && (
        <>
          <BottomNav />
          <Dock />
        </>
      )}

      {/* Desktop-only; renders nothing in the phone layout. */}
      <CommandPalette />
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
