import { NextResponse, type NextRequest } from "next/server";
import { hashOtp } from "@/shared/lib/otp";
import { getSupabaseAdmin } from "@/shared/lib/supabase/admin";
import { getSupabaseServer } from "@/shared/lib/supabase/server";
import { normalizeTelegramUsername } from "@/shared/lib/telegram";

const MAX_ATTEMPTS = 5;
const MAX_OTP_CONFLICT_RETRIES = 10;

function telegramEmail(telegramId: number): string {
  return `tg-${telegramId}@telegram.deepgym.app`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = normalizeTelegramUsername(String(body.username ?? ""));
  const code = String(body.code ?? "").trim();

  if (!username || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: link, error: linkLookupError } = await admin
    .from("telegram_links")
    .select("telegram_id, username, user_id")
    .ilike("username", username)
    .maybeSingle();
  if (linkLookupError) {
    return NextResponse.json({ error: "Failed to verify code" }, { status: 500 });
  }
  if (!link) {
    return NextResponse.json({ error: "Unknown username" }, { status: 404 });
  }

  const submittedHash = hashOtp(code, link.telegram_id);
  let consumed = false;
  for (let retry = 0; retry < MAX_OTP_CONFLICT_RETRIES; retry++) {
    const { data: otp, error: otpLookupError } = await admin
      .from("telegram_otps")
      .select("id, code_hash, attempts, expires_at")
      .eq("telegram_id", link.telegram_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (otpLookupError) {
      return NextResponse.json({ error: "Failed to verify code" }, { status: 500 });
    }
    if (!otp || new Date(otp.expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Code expired. Request a new one." },
        { status: 410 },
      );
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts. Request a new code." },
        { status: 429 },
      );
    }

    // Compare-and-swap on attempts: concurrent requests cannot share a try.
    // Include expiry in the write so a code expiring after the read is rejected.
    const stillValidAt = new Date().toISOString();
    if (otp.code_hash !== submittedHash) {
      const { data: updated, error: updateError } = await admin
        .from("telegram_otps")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id)
        .eq("attempts", otp.attempts)
        .gt("expires_at", stillValidAt)
        .select("id");
      if (updateError) {
        return NextResponse.json({ error: "Failed to verify code" }, { status: 500 });
      }
      if (updated?.length) {
        return NextResponse.json(
          { error: `Wrong code (${MAX_ATTEMPTS - otp.attempts - 1} attempts left)` },
          { status: 401 },
        );
      }
      continue;
    }

    // Only the request that deleted this exact OTP version may mint a session.
    const { data: deleted, error: deleteError } = await admin
      .from("telegram_otps")
      .delete()
      .eq("id", otp.id)
      .eq("attempts", otp.attempts)
      .gt("expires_at", stillValidAt)
      .select("id");
    if (deleteError) {
      return NextResponse.json({ error: "Failed to verify code" }, { status: 500 });
    }
    if (deleted?.length) {
      consumed = true;
      break;
    }
  }
  if (!consumed) {
    return NextResponse.json(
      { error: "Code verification was busy. Try again." },
      { status: 409 },
    );
  }

  // Keep the original invalidation behavior if concurrent code requests ever
  // left older OTP rows behind. None of those codes may become usable after
  // the latest code has been consumed.
  const { error: cleanupError } = await admin
    .from("telegram_otps")
    .delete()
    .eq("telegram_id", link.telegram_id);
  if (cleanupError) {
    return NextResponse.json({ error: "Failed to verify code" }, { status: 500 });
  }

  // Find or create the Supabase user
  const email = telegramEmail(link.telegram_id);
  let userId = link.user_id as string | null;

  if (!userId) {
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          telegram_id: String(link.telegram_id),
          telegram_username: link.username,
          full_name: link.username ? `@${link.username}` : "Athlete",
        },
      });

    if (createError) {
      // User may already exist from a previous login — look them up
      const { data: byEmail } = await admin
        .from("profiles")
        .select("id")
        .eq("telegram_id", link.telegram_id)
        .maybeSingle();
      if (!byEmail) {
        return NextResponse.json(
          { error: "Failed to create account" },
          { status: 500 },
        );
      }
      userId = byEmail.id;
    } else {
      userId = created.user.id;
    }

    await admin
      .from("telegram_links")
      .update({ user_id: userId })
      .eq("telegram_id", link.telegram_id);
    await admin
      .from("profiles")
      .update({
        telegram_id: link.telegram_id,
        telegram_username: link.username,
      })
      .eq("id", userId);
  }

  // Mint a session for this user via an admin magic link consumed server-side
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !linkData.properties?.hashed_token) {
    return NextResponse.json({ error: "Failed to sign in" }, { status: 500 });
  }

  const supabase = await getSupabaseServer();
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError) {
    return NextResponse.json({ error: "Failed to sign in" }, { status: 500 });
  }

  // Web clients get the session via cookies (set above); native clients
  // (the Expo app) need the tokens in the body to call setSession().
  return NextResponse.json({
    ok: true,
    session: verifyData.session
      ? {
          access_token: verifyData.session.access_token,
          refresh_token: verifyData.session.refresh_token,
        }
      : null,
  });
}
