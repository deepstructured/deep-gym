"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  GoogleSignInButton,
  TelegramOtpForm,
} from "@/features/auth";
import { isSupabaseConfigured } from "@/shared/config/env";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import {
  BrandMark,
  Card,
  ErrorNote,
  IconTelegram,
  Segmented,
} from "@/shared/ui";
import styles from "./login-view.module.scss";

function LoginContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [method, setMethod] = useState<"google" | "telegram">("google");
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

      <Segmented
        className={styles.methodSwitch}
        value={method}
        onChange={setMethod}
        options={[
          { value: "google", label: "Google" },
          { value: "telegram", label: "Telegram" },
        ]}
      />

      {method === "google" ? (
        <GoogleSignInButton />
      ) : (
        <TelegramOtpForm />
      )}

      {method === "telegram" && (
        <div className={styles.botNote}>
          <IconTelegram size={14} />
          {t("login.botNote")}
        </div>
      )}
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
