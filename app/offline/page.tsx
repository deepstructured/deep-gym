"use client";

import { useI18n } from "@/shared/i18n";
import { BrandMark } from "@/shared/ui";

export default function OfflinePage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-5 text-center">
      <BrandMark width={72} className="mb-3" />
      <p className="font-dot text-4xl text-lime">Offline</p>
      <p className="text-sm text-muted">{t("offline.message")}</p>
    </main>
  );
}
