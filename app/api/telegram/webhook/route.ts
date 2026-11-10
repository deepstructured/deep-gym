import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/shared/lib/supabase/admin";
import { sendTelegramMessage } from "@/shared/lib/telegram";
import { ownAuthEnabled, withAuthDb } from "@/server/auth";

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
  // A group message must never redirect a person's future login codes to a
  // chat where other members can read them.
  if (message.chat.type !== "private" || String(message.chat.id) !== String(from.id)) {
    return NextResponse.json({ ok: true });
  }

  if (ownAuthEnabled()) {
    try {
      await withAuthDb((db) => db.query("insert into public.telegram_links(telegram_id,chat_id,username,updated_at) values($1,$2,$3,now()) on conflict(telegram_id) do update set chat_id=excluded.chat_id,username=excluded.username,updated_at=now()", [from.id,message.chat.id,from.username ? String(from.username).toLowerCase() : null]).then(() => undefined));
    } catch { return NextResponse.json({ error: "Bot service unavailable" }, { status: 503 }); }
  } else {
    const admin = getSupabaseAdmin();
    await admin.from("telegram_links").upsert({
    telegram_id: from.id,
    chat_id: message.chat.id,
    username: from.username ? String(from.username).toLowerCase() : null,
    updated_at: new Date().toISOString(),
  });
  }

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
