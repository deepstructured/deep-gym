import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/shared/lib/supabase/admin";
import { sendTelegramMessage } from "@/shared/lib/telegram";

/**
 * Telegram bot webhook. Records chat_id/username for every user who talks
 * to the bot so the login flow can later send them OTP codes.
 *
 * Register it once:
 * curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *   -d "url=<SITE_URL>/api/telegram/webhook" \
 *   -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const update = await request.json().catch(() => null);
  const message = update?.message;
  const from = message?.from;
  if (!from?.id || !message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const admin = getSupabaseAdmin();
  await admin.from("telegram_links").upsert({
    telegram_id: from.id,
    chat_id: message.chat.id,
    username: from.username ? String(from.username).toLowerCase() : null,
    updated_at: new Date().toISOString(),
  });

  if (typeof message.text === "string" && message.text.startsWith("/start")) {
    const name = from.first_name ?? "athlete";
    await sendTelegramMessage(
      message.chat.id,
      `💪 Hey ${name}! Your Telegram is now linked to <b>DeepGym</b>.\n\n` +
        (from.username
          ? `Log in with your username <b>@${from.username}</b> — I'll send you a one-time code.`
          : `⚠️ You don't have a Telegram username set. Add one in Telegram settings, then send /start again.`),
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
