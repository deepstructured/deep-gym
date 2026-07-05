/**
 * Local-dev replacement for the Telegram webhook.
 *
 * Telegram can't reach localhost, so instead of a webhook this script
 * long-polls getUpdates and performs the same work as
 * app/api/telegram/webhook/route.ts: it links every user who presses
 * /start (telegram_id + chat_id + username → telegram_links) and sends
 * the greeting message.
 *
 * Usage:  node scripts/telegram-dev-poll.mjs
 * Stop:   Ctrl+C
 *
 * NOTE: don't run this in production — register the real webhook instead
 * (see README). A registered webhook and getUpdates are mutually exclusive.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// minimal .env.local loader (no dotenv dependency)
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing TELEGRAM_BOT_TOKEN / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const api = (method, params) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params ?? {}),
  }).then((res) => res.json());

async function handleMessage(message) {
  const from = message?.from;
  if (!from?.id || !message?.chat?.id) return;

  const username = from.username ? String(from.username).toLowerCase() : null;

  const { error } = await supabase.from("telegram_links").upsert({
    telegram_id: from.id,
    chat_id: message.chat.id,
    username,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("  ✗ supabase upsert failed:", error.message);
    return;
  }
  console.log(
    `  ✓ linked @${username ?? "<no username>"} (telegram_id ${from.id})`,
  );

  if (typeof message.text === "string" && message.text.startsWith("/start")) {
    await api("sendMessage", {
      chat_id: message.chat.id,
      parse_mode: "HTML",
      text:
        `💪 Hey ${from.first_name ?? "athlete"}! Your Telegram is now linked to <b>DeepGym</b>.\n\n` +
        (username
          ? `Log in with your username <b>@${from.username}</b> — I'll send you a one-time code.`
          : `⚠️ You don't have a Telegram username set. Add one in Telegram settings, then send /start again.`),
    });
  }
}

console.log("Polling Telegram for updates… press /start in the bot now.");
console.log("(Ctrl+C to stop)\n");

let offset = 0;
for (;;) {
  try {
    const res = await api("getUpdates", { offset, timeout: 25 });
    if (!res.ok) {
      console.error("getUpdates error:", res.description);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    for (const update of res.result) {
      offset = update.update_id + 1;
      if (update.message) await handleMessage(update.message);
    }
  } catch (err) {
    console.error("network error:", err.message);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
