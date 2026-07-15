"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  GoogleSignInButton,
  TelegramOtpForm,
} from "@/features/auth";
import { isSupabaseConfigured } from "@/shared/config/env";
import { useI18n } from "@/shared/i18n";
import {
  BrandMark,
  Card,
  ErrorNote,
  IconTelegram,
  Segmented,
} from "@/shared/ui";

function LoginContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [method, setMethod] = useState<"google" | "telegram">("google");
  const oauthFailed = searchParams.get("error") === "oauth";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-10 text-center">
        <div className="mb-6 flex justify-center">
          <Card variant="indigo" className="w-full max-w-72 px-6 py-8">
            <div className="dots-bg pointer-events-none absolute inset-0 opacity-[0.08]" />
            <BrandMark width={112} className="relative mx-auto" />
            <p className="relative mt-5 text-center text-base font-semibold tracking-[0.16em] text-white uppercase">
              DeepGym
            </p>
            <p className="relative mt-1.5 text-center text-[13px] text-white/60">
              {t("login.tagline")}
            </p>
          </Card>
        </div>
        <h1 className="text-2xl font-semibold">{t("login.welcome")}</h1>
        <p className="mt-1 text-sm text-muted">{t("login.signInToStart")}</p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-5">
          <ErrorNote message="Supabase is not configured yet. Copy .env.example to .env.local, fill in the keys and restart — see README.md." />
        </div>
      )}

      {oauthFailed && (
        <div className="mb-5">
          <ErrorNote message={t("login.googleFailed")} />
        </div>
      )}

      <Segmented
        className="mb-6"
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
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-faint">
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
