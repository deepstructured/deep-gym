"use client";

import { useI18n } from "@/shared/i18n";
import { useNow } from "@/shared/lib/use-now";

/** "12 min" / "1 h 05 min" since an ISO timestamp, refreshed live. */
export function ElapsedSince({ since }: { since: string }) {
  const { t } = useI18n();
  const now = useNow();
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(since).getTime()) / 60_000),
  );
  if (minutes < 60) return <>{t("draft.minutes", { m: minutes })}</>;
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) return <>{t("draft.days", { d: Math.floor(hours / 24) })}</>;
  return (
    <>
      {t("draft.hours", {
        h: hours,
        m: String(minutes % 60).padStart(2, "0"),
      })}
    </>
  );
}
