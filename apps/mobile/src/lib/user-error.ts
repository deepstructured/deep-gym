import type { MessageKey } from "@deepgym/core/i18n";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** Server and SDK messages are implementation details; only known cases reach the UI. */
const ERROR_KEYS: Record<string, MessageKey> = {
  "Not signed in": "error.signInRequired",
  "Name is required": "error.nameRequired",
  "Body weight must be greater than zero": "bodyWeight.invalid",
  "Add a name, type and at least one exercise": "templates.completeRequired",
  "Add an exercise first": "workout.addExercise",
  "Invalid login credentials": "login.invalidCredentials",
  "EXPO_PUBLIC_WEB_URL is missing in apps/mobile/.env.local": "login.configUnavailable",
  "Google did not return a session. Try again.": "login.googleSessionMissing",
  "Google sign-in could not start.": "login.googleStartFailed",
  "Apple sign-in is unavailable on this device.": "login.appleUnavailable",
  "Apple sign-in state did not match. Try again.": "login.appleRetry",
  "Apple did not return an identity token.": "login.appleRetry",
  "Enter your Telegram username": "login.telegramUsernameRequired",
  "This username is not linked yet. Open the bot in Telegram, press Start, then try again.": "login.telegramNotLinked",
  "Code already sent. Wait a minute before requesting again.": "login.telegramRateLimit",
  "Couldn't reach you in Telegram. Open the bot and press Start.": "login.telegramBotUnavailable",
  "Enter the 6-digit code": "login.telegramCodeRequired",
  "Unknown username": "login.telegramUnknownUsername",
  "Code expired. Request a new one.": "login.telegramCodeExpired",
  "Too many attempts. Request a new code.": "login.telegramTooManyAttempts",
  "Code verification was busy. Try again.": "login.telegramVerifyBusy",
  "Failed to verify code": "login.telegramVerifyFailed",
  "Failed to create code": "login.telegramSendFailed",
  "Failed to create account": "login.signInFailed",
  "Failed to sign in": "login.signInFailed",
  "The server did not return a session.": "login.signInFailed",
  "Sign in again before deleting your account": "settings.deleteAccountSignInAgain",
  "Authentication required": "settings.deleteAccountSignInAgain",
  "Invalid session": "settings.deleteAccountSignInAgain",
  "Could not delete this account. Please try again.": "settings.deleteAccountFailed",
};

export function userErrorMessage(
  t: Translate,
  cause: unknown,
  fallback: MessageKey = "common.error",
): string {
  const message = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  const wrongCode = /^Wrong code \((\d+) attempts left\)$/.exec(message);
  if (wrongCode) return t("login.telegramWrongCode", { count: Number(wrongCode[1]) });
  return t(ERROR_KEYS[message] ?? fallback);
}
