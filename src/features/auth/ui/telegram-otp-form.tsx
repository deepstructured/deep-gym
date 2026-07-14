"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TELEGRAM_BOT_USERNAME } from "@/shared/config/env";
import { useI18n } from "@/shared/i18n";
import { Button, ErrorNote, Field, IconTelegram, Input } from "@/shared/ui";

type Step = "username" | "code";

async function post(url: string, body: unknown, fallbackError: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? fallbackError);
  return data;
}

export function TelegramOtpForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setLoading(true);
    setError(null);
    try {
      await post(
        "/api/auth/telegram/request",
        { username },
        t("common.error"),
      );
      setStep("code");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setLoading(true);
    setError(null);
    try {
      await post(
        "/api/auth/telegram/verify",
        { username, code },
        t("common.error"),
      );
      router.push("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {step === "username" ? (
        <>
          <Field label={t("login.telegramUsername")}>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              autoCapitalize="none"
              autoCorrect="off"
              onKeyDown={(e) => e.key === "Enter" && username && requestCode()}
            />
          </Field>
          {TELEGRAM_BOT_USERNAME && (
            <p className="text-[13px] leading-relaxed text-muted">
              {t("login.firstTime")}{" "}
              <a
                href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-lime"
              >
                @{TELEGRAM_BOT_USERNAME}
              </a>
            </p>
          )}
          {error && <ErrorNote message={error} />}
          <Button
            variant="lime"
            size="lg"
            className="w-full"
            onClick={requestCode}
            loading={loading}
            disabled={!username.trim()}
          >
            {!loading && <IconTelegram size={19} />}
            {t("login.sendCode")}
          </Button>
        </>
      ) : (
        <>
          <Field
            label={t("login.codeSent", {
              username: username.replace(/^@/, ""),
            })}
          >
            <Input
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="••••••"
              inputMode="numeric"
              autoFocus
              className="text-center font-dot text-2xl tracking-[0.4em]"
              onKeyDown={(e) =>
                e.key === "Enter" && code.length === 6 && verifyCode()
              }
            />
          </Field>
          {error && <ErrorNote message={error} />}
          <Button
            variant="lime"
            size="lg"
            className="w-full"
            onClick={verifyCode}
            loading={loading}
            disabled={code.length !== 6}
          >
            {t("login.signIn")}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted"
            onClick={() => {
              setStep("username");
              setCode("");
              setError(null);
            }}
          >
            {t("login.differentUsername")}
          </button>
        </>
      )}
    </div>
  );
}
