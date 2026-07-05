import { createHash } from "node:crypto";

/** Server-side only. Peppered hash so raw codes never touch the DB. */
export function hashOtp(code: string, telegramId: number): string {
  const pepper = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  return createHash("sha256")
    .update(`${code}:${telegramId}:${pepper}`)
    .digest("hex");
}
