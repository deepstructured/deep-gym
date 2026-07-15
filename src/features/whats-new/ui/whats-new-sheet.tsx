"use client";

import { useCallback } from "react";
import { CURRENT_RELEASE } from "@/shared/config/releases";
import { useI18n } from "@/shared/i18n";
import {
  Avatar,
  BrandMark,
  Button,
  ErrorNote,
  IconCalendar,
  IconDumbbell,
  IconHistory,
  Sheet,
} from "@/shared/ui";

interface WhatsNewSheetProps {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
}

const RELEASE_ITEMS = [
  {
    title: "whatsNew.dashboard.title",
    body: "whatsNew.dashboard.body",
    icon: IconHistory,
    tone: "border-indigo-bright/25 bg-indigo/25 text-[#aeb8ff]",
  },
  {
    title: "whatsNew.schedule.title",
    body: "whatsNew.schedule.body",
    icon: IconCalendar,
    tone: "border-cherry/25 bg-cherry/10 text-[#ff8b78]",
  },
  {
    title: "whatsNew.avatars.title",
    body: "whatsNew.avatars.body",
    icon: IconDumbbell,
    tone: "border-lime/20 bg-lime/10 text-lime",
  },
] as const;

export function WhatsNewSheet({
  open,
  onClose,
  loading = false,
  error,
}: WhatsNewSheetProps) {
  const { t } = useI18n();
  const close = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  return (
    <Sheet open={open} onClose={close} title={t("whatsNew.title")}>
      <div className="space-y-5">
        <div className="grad-indigo dots-bg relative overflow-hidden rounded-card p-5">
          <div className="relative z-10 flex items-start justify-between gap-4">
            <BrandMark width={34} />
            <span className="rounded-full border border-white/15 bg-black/15 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-white/70 uppercase">
              {t("whatsNew.version", { version: CURRENT_RELEASE.label })}
            </span>
          </div>
          <div className="relative z-10 mt-8 max-w-[18rem]">
            <h3 className="text-2xl leading-tight font-semibold">
              {t("whatsNew.releaseTitle")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/68">
              {t("whatsNew.releaseBody")}
            </p>
          </div>
          <div className="relative z-10 mt-5 flex -space-x-2">
            {[
              "/avatars/deepgym-pixel-portal.webp",
              "/avatars/deepgym-pixel-mountain.webp",
              "/avatars/deepgym-pixel-pulse.webp",
            ].map((src) => (
              <Avatar
                key={src}
                src={src}
                size={40}
                className="border-2 border-[#111532]"
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {RELEASE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex gap-3 rounded-tile border border-line/70 bg-raised/55 p-3.5"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${item.tone}`}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-semibold">{t(item.title)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {t(item.body)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {error && <ErrorNote message={error} />}

        <Button
          type="button"
          variant="lime"
          size="lg"
          className="w-full"
          loading={loading}
          onClick={close}
        >
          {t("whatsNew.gotIt")}
        </Button>
      </div>
    </Sheet>
  );
}
