"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TELEGRAM_BOT_USERNAME } from "@/shared/config/env";
import { Button, ErrorNote, Field, IconTelegram, Input } from "@/shared/ui";

type Step = "username" | "code";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

export function TelegramOtpForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setLoading(true);
    setError(null);
    try {
      await post("/api/auth/telegram/request", { username });
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
      await post("/api/auth/telegram/verify", { username, code });
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
          <Field label="Telegram username">
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
              First time here? Open{" "}
              <a
                href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-lime"
              >
                @{TELEGRAM_BOT_USERNAME}
              </a>{" "}
              in Telegram and press <b>Start</b> — then come back and enter
              your username.
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
            Send code
          </Button>
        </>
      ) : (
        <>
          <Field label={`Code sent to @${username.replace(/^@/, "")}`}>
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
            Sign in
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
            Use a different username
          </button>
        </>
      )}
    </div>
  );
}
