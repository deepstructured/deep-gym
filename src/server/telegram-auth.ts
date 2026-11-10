import "server-only";
import { randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { hashOtp } from "@/shared/lib/otp";
import { normalizeTelegramUsername, sendTelegramMessage } from "@/shared/lib/telegram";
import { assertAuthCsrf, issueSession, setSessionCookies, withAuthDb } from "./auth";
import { readJsonObject, RequestBodyError } from "./request-body";

export async function telegramAuth(request: Request, operation: "request" | "verify") {
  const headers = { "Cache-Control": "private, no-store" };
  try { assertAuthCsrf(request); } catch { return NextResponse.json({ error: "Invalid request origin" }, { status: 403, headers }); }
  let body;
  try { body = await readJsonObject(request,4096); }
  catch (error) { return NextResponse.json({ error: "Invalid request body" }, { status: error instanceof RequestBodyError ? error.status : 400, headers }); }
  const username = normalizeTelegramUsername(String(body.username ?? ""));
  const code = String(body.code ?? "");
  if (!username || (operation === "verify" && !/^\d{6}$/.test(code))) return NextResponse.json({ error: "Enter your Telegram username and code" }, { status: 400, headers });
  try {
    if (operation === "request") {
      const rawCode = String(randomInt(100000, 1000000));
      const result = await withAuthDb(async (db) => {
        const links = await db.query("select telegram_id,chat_id from public.telegram_links where lower(username)=lower($1) for update", [username]);
        if (links.rows.length !== 1) return { error: "Open the Telegram bot and press Start first", status: 404 };
        const link = links.rows[0];
        if (String(link.chat_id) !== String(link.telegram_id)) return { error: "Open a private chat with the Telegram bot and press Start", status: 400 };
        const recent = await db.query("select id from public.telegram_otps where telegram_id=$1 and created_at>now()-interval '1 minute' limit 1", [link.telegram_id]);
        if (recent.rows.length) return { error: "Code already sent. Wait a minute", status: 429 };
        await db.query("delete from public.telegram_otps where telegram_id=$1", [link.telegram_id]);
        await db.query("insert into public.telegram_otps(id,telegram_id,code_hash,attempts,expires_at) values($1,$2,$3,0,now()+interval '5 minutes')", [randomUUID(),link.telegram_id,hashOtp(rawCode,Number(link.telegram_id))]);
        return { chatId: Number(link.chat_id) };
      });
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status, headers });
      await sendTelegramMessage(result.chatId, `🔐 Your DeepGym login code:\n\n<code>${rawCode}</code>\n\nIt expires in 5 minutes. If it wasn't you, ignore this message.`);
      return NextResponse.json({ ok: true }, { headers });
    }
    const result = await withAuthDb(async (db) => {
      // Locking the account serializes resend/verify, so an OTP is consumed
      // exactly once and rejected attempts remain committed in the same row.
      const links = await db.query("select telegram_id,chat_id,username,user_id from public.telegram_links where lower(username)=lower($1) for update", [username]);
      if (links.rows.length !== 1) return { error: "Unknown username", status: 404 };
      const link = links.rows[0];
      if (String(link.chat_id) !== String(link.telegram_id)) return { error: "Open a private chat with the Telegram bot and press Start", status: 400 };
      const codes = await db.query("select id,code_hash,attempts from public.telegram_otps where telegram_id=$1 and expires_at>now() order by created_at desc limit 1 for update", [link.telegram_id]);
      const otp = codes.rows[0];
      if (!otp) return { error: "Code expired. Request a new one", status: 410 };
      if (otp.attempts >= 5) return { error: "Too many attempts. Request a new code", status: 429 };
      const expected = Buffer.from(String(otp.code_hash));
      const actual = Buffer.from(hashOtp(code,Number(link.telegram_id)));
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        await db.query("update public.telegram_otps set attempts=attempts+1 where id=$1", [otp.id]);
        return { error: "Wrong code", status: 401 };
      }
      await db.query("delete from public.telegram_otps where telegram_id=$1", [link.telegram_id]);
      let userId = link.user_id as string | null;
      if (!userId) {
        const existing = await db.query("select id from public.profiles where telegram_id=$1", [link.telegram_id]);
        userId = existing.rows[0]?.id ?? null;
      }
      if (!userId) {
        userId = randomUUID();
        await db.query("insert into auth.users(id,email,aud,role,raw_user_meta_data,raw_app_meta_data,email_confirmed_at,created_at,updated_at) values($1,$2,'authenticated','authenticated',$3,$4,now(),now(),now())", [userId,`tg-${link.telegram_id}@telegram.deepgym.app`,{ telegram_id: String(link.telegram_id), telegram_username: link.username, full_name: `@${link.username}` },{ provider: "telegram", providers: ["telegram"] }]);
      }
      await db.query("update public.telegram_links set user_id=$1 where telegram_id=$2", [userId,link.telegram_id]);
      await db.query("update public.profiles set telegram_id=$1,telegram_username=$2 where id=$3", [link.telegram_id,link.username,userId]);
      return { session: await issueSession(db,userId) };
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status, headers });
    // Existing native clients require both tokens in this response. New web
    // clients use the HttpOnly cookies; the contract remains compatible.
    const response = NextResponse.json({ ok: true, session: result.session }, { headers });
    setSessionCookies(response,result.session);
    return response;
  } catch { return NextResponse.json({ error: "Telegram sign-in is temporarily unavailable" }, { status: 503, headers }); }
}
