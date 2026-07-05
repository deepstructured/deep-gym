import { randomInt } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { hashOtp } from "@/shared/lib/otp";
import { getSupabaseAdmin } from "@/shared/lib/supabase/admin";
import {
  normalizeTelegramUsername,
  sendTelegramMessage,
} from "@/shared/lib/telegram";

const OTP_TTL_MS = 5 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = normalizeTelegramUsername(String(body.username ?? ""));
  if (!username) {
    return NextResponse.json(
      { error: "Enter your Telegram username" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data: link } = await admin
    .from("telegram_links")
    .select("telegram_id, chat_id")
    .ilike("username", username)
    .maybeSingle();

  if (!link) {
    return NextResponse.json(
      {
        error:
          "This username is not linked yet. Open the bot in Telegram, press Start, then try again.",
      },
      { status: 404 },
    );
  }

  const { data: recent } = await admin
    .from("telegram_otps")
    .select("created_at")
    .eq("telegram_id", link.telegram_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    recent &&
    Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS
  ) {
    return NextResponse.json(
      { error: "Code already sent. Wait a minute before requesting again." },
      { status: 429 },
    );
  }

  const code = String(randomInt(100000, 1000000));

  // Invalidate previous codes, store the new one
  await admin.from("telegram_otps").delete().eq("telegram_id", link.telegram_id);
  const { error: insertError } = await admin.from("telegram_otps").insert({
    telegram_id: link.telegram_id,
    code_hash: hashOtp(code, link.telegram_id),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (insertError) {
    return NextResponse.json({ error: "Failed to create code" }, { status: 500 });
  }

  try {
    await sendTelegramMessage(
      link.chat_id,
      `🔐 Your DeepGym login code: <b>${code}</b>\n\nIt expires in 5 minutes. If it wasn't you — just ignore this message.`,
    );
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach you in Telegram. Open the bot and press Start." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
