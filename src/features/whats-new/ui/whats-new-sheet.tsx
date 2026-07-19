"use client";

import { useCallback } from "react";
import { CURRENT_RELEASE } from "@/shared/config/releases";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import {
  Avatar,
  BrandMark,
  Button,
  ErrorNote,
  IconCalendar,
  IconCompare,
  IconHistory,
  Sheet,
} from "@/shared/ui";
import styles from "./whats-new-sheet.module.scss";

interface WhatsNewSheetProps {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
}

const RELEASE_ITEMS = [
  {
    title: "whatsNew.draftSync.title",
    body: "whatsNew.draftSync.body",
    icon: IconCompare,
    tone: styles.toneIndigo,
  },
  {
    title: "whatsNew.copyLast.title",
    body: "whatsNew.copyLast.body",
    icon: IconHistory,
    tone: styles.toneCherry,
  },
  {
    title: "whatsNew.copyPicker.title",
    body: "whatsNew.copyPicker.body",
    icon: IconCalendar,
    tone: styles.toneLime,
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
      <div className={styles.body}>
        <div className={cn(styles.hero, "grad-indigo dots-bg")}>
          <div className={styles.heroTop}>
            <BrandMark width={34} />
            <span className={styles.versionBadge}>
              {t("whatsNew.version", { version: CURRENT_RELEASE.label })}
            </span>
          </div>
          <div className={styles.heroText}>
            <h3 className={styles.heroTitle}>{t("whatsNew.releaseTitle")}</h3>
            <p className={styles.heroBody}>{t("whatsNew.releaseBody")}</p>
          </div>
          <div className={styles.heroAvatars}>
            {[
              "/avatars/deepgym-pixel-portal.webp",
              "/avatars/deepgym-pixel-mountain.webp",
              "/avatars/deepgym-pixel-pulse.webp",
            ].map((src) => (
              <Avatar
                key={src}
                src={src}
                size={40}
                className={styles.heroAvatar}
              />
            ))}
          </div>
        </div>

        <div className={styles.items}>
          {RELEASE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className={styles.item}>
                <span className={cn(styles.itemIcon, item.tone)}>
                  <Icon size={18} />
                </span>
                <div className={styles.itemText}>
                  <p className={styles.itemTitle}>{t(item.title)}</p>
                  <p className={styles.itemBody}>{t(item.body)}</p>
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
          block
          loading={loading}
          onClick={close}
        >
          {t("whatsNew.gotIt")}
        </Button>
      </div>
    </Sheet>
  );
}
