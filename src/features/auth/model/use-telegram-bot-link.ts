"use client";

import { useEffect, useState } from "react";
import { TELEGRAM_BOT_USERNAME } from "@/shared/config/env";

const PROBE_TIMEOUT_MS = 2500;

/**
 * Link to the bot with a resilient host: t.me by default, telegram.me when
 * t.me doesn't respond (in July 2026 the .me registrar briefly suspended
 * t.me and browser links died while Telegram itself kept working).
 *
 * The probe is a no-cors fetch: an opaque response means the host resolves
 * and answers — only a network/DNS-level failure (or a hung request) flips
 * the link to the backup domain.
 */
export function useTelegramBotLink(): string {
  const [host, setHost] = useState("t.me");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    fetch("https://t.me/", { mode: "no-cors", signal: controller.signal })
      .catch(() => {
        if (!cancelled) setHost("telegram.me");
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return `https://${host}/${TELEGRAM_BOT_USERNAME}`;
}
