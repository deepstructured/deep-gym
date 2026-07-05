"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import { IconChevronLeft } from "@/shared/ui";
import { BottomNav } from "./bottom-nav";

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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-4 pb-32">
      {(title || back || action) && (
        <header className="sticky top-0 z-30 -mx-5 mb-4 flex items-center gap-3 bg-bg/85 px-5 py-3 backdrop-blur-xl">
          {back && (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Back"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-text"
            >
              <IconChevronLeft size={20} />
            </button>
          )}
          {title && (
            <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">
              {title}
            </h1>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("flex-1", className)}>{children}</div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
