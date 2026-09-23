"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  GoogleSignInButton,
  TelegramOtpForm,
  useTelegramBotLink,
} from "@/features/auth";
import { isSupabaseConfigured, TELEGRAM_BOT_USERNAME } from "@/shared/config/env";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import {
  BrandMark,
  Button,
  Card,
  ErrorNote,
  IconChevronRight,
  IconTelegram,
} from "@/shared/ui";
import styles from "./login-view.module.scss";

function AppleMark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.47-2.09-.49-3.24 0-1.44.62-2.21.44-3.07-.35-4.89-5.05-4.16-12.75 1.61-13.03 1.4.07 2.38.8 3.19.86 1.22-.25 2.39-.96 3.69-.87 1.56.12 2.74.73 3.51 1.83-3.42 2.09-2.61 6.5.54 7.77-.64 1.31-1.48 2.61-3.15 3.44ZM12.36 7.22c-.15-1.86 1.52-3.4 3.22-3.55.21 1.88-1.72 3.43-3.22 3.55Z" />
    </svg>
  );
}

function LoginContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [telegramOpen, setTelegramOpen] = useState(false);
  const botUsername = TELEGRAM_BOT_USERNAME.trim().replace(/^@+/, "");
  const botLink = useTelegramBotLink();
  const oauthFailed = searchParams.get("error") === "oauth";

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <div className={styles.brandWrap}>
          <Card variant="indigo" className={styles.brandCard}>
            <div className={cn(styles.brandDots, "dots-bg")} />
            <BrandMark width={112} className={styles.brandMark} />
            <p className={styles.brandName}>
              DeepGym
            </p>
            <p className={styles.tagline}>
              {t("login.tagline")}
            </p>
          </Card>
        </div>
        <h1 className={styles.welcome}>{t("login.welcome")}</h1>
        <p className={styles.subtitle}>{t("login.signInToStart")}</p>
      </div>

      {!isSupabaseConfigured && (
        <div className={styles.notice}>
          <ErrorNote message="Supabase is not configured yet. Copy .env.example to .env.local, fill in the keys and restart — see README.md." />
        </div>
      )}

      {oauthFailed && (
        <div className={styles.notice}>
          <ErrorNote message={t("login.googleFailed")} />
        </div>
      )}

      <div className={styles.providerActions}>
        <GoogleSignInButton />
        <Button
          variant="surface"
          size="lg"
          block
          type="button"
          className={cn(styles.telegramButton, telegramOpen && styles.telegramButtonOpen)}
          aria-expanded={telegramOpen}
          aria-controls="telegram-sign-in"
          onClick={() => setTelegramOpen((open) => !open)}
        >
          <IconTelegram size={20} />
          {t("login.continueTelegram")}
        </Button>
        <button className={styles.applePlaceholder} type="button" disabled>
          <AppleMark />
          <span>{t("login.continueApple")}</span>
          <span className={styles.comingSoon}>{t("login.comingSoon")}</span>
        </button>
      </div>

      {botUsername && (
        <div className={styles.telegramHelp}>
          <p>{t("login.telegramFirstStep")}</p>
          <a
            href={botLink}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.botLink}
          >
            <IconTelegram size={19} />
            <span>{t("login.openTelegramBot", { username: botUsername })}</span>
            <IconChevronRight size={18} />
          </a>
        </div>
      )}

      {telegramOpen && (
        <div id="telegram-sign-in" className={styles.telegramPanel}>
          <TelegramOtpForm />
        </div>
      )}

      <Link className={styles.privacyLink} href="/privacy">
        {t("settings.privacyPolicy")}
      </Link>
    </main>
  );
}

export function LoginView() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
