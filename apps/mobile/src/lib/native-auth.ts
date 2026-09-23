import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { supabase } from "./supabase";

// Add this exact URL to Supabase Auth > URL Configuration > Redirect URLs.
export const OAUTH_REDIRECT_URL = "deepgym://auth/callback";

WebBrowser.maybeCompleteAuthSession();

const exchanges = new Map<string, Promise<void>>();

export async function createSessionFromUrl(url: string): Promise<void> {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const fragment = new URLSearchParams(parsed.hash.slice(1));
  const error =
    query.get("error_description") ??
    fragment.get("error_description") ??
    query.get("error") ??
    fragment.get("error");
  if (error) throw new Error(error);

  const code = query.get("code") ?? fragment.get("code");
  if (code) {
    let exchange = exchanges.get(code);
    if (!exchange) {
      exchange = supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) throw error;
      });
      exchanges.set(code, exchange);
      void exchange.catch(() => exchanges.delete(code));
    }
    await exchange;
    return;
  }

  const access_token = query.get("access_token") ?? fragment.get("access_token");
  const refresh_token =
    query.get("refresh_token") ?? fragment.get("refresh_token");
  if (access_token && refresh_token) {
    const result = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (result.error) throw result.error;
    return;
  }

  throw new Error("Google did not return a session. Try again.");
}

export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: OAUTH_REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Google sign-in could not start.");

  const result = await WebBrowser.openAuthSessionAsync(
    data.url,
    OAUTH_REDIRECT_URL,
  );
  if (result.type === "success") {
    await createSessionFromUrl(result.url);
  }
}

export async function signInWithApple(): Promise<void> {
  if (
    Platform.OS !== "ios" ||
    !(await AppleAuthentication.isAvailableAsync())
  ) {
    throw new Error("Apple sign-in is unavailable on this device.");
  }

  // Supabase verifies SHA-256(rawNonce) against the nonce in Apple's ID token.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  const state = Crypto.randomUUID();

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
      state,
    });
  } catch (cause) {
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      cause.code === "ERR_REQUEST_CANCELED"
    ) {
      return;
    }
    throw cause;
  }

  if (credential.state !== state) {
    throw new Error("Apple sign-in state did not match. Try again.");
  }
  if (!credential.identityToken) {
    throw new Error("Apple did not return an identity token.");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Apple only returns the name on the first authorization. Save it now.
  const givenName = credential.fullName?.givenName?.trim();
  const familyName = credential.fullName?.familyName?.trim();
  const fullName = [givenName, familyName].filter(Boolean).join(" ");
  if (fullName) {
    await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        given_name: givenName,
        family_name: familyName,
      },
    });
  }
}

type TelegramResult = {
  ok?: boolean;
  error?: string;
  session?: { access_token: string; refresh_token: string } | null;
};

async function telegramPost(
  path: "request" | "verify",
  body: { username: string; code?: string },
): Promise<TelegramResult> {
  const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "");
  if (!webUrl) {
    throw new Error("EXPO_PUBLIC_WEB_URL is missing in apps/mobile/.env.local");
  }

  const response = await fetch(`${webUrl}/api/auth/telegram/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as TelegramResult;
  if (!response.ok) {
    throw new Error(data.error || `Telegram sign-in failed (${response.status})`);
  }
  return data;
}

export async function requestTelegramCode(username: string): Promise<void> {
  await telegramPost("request", { username });
}

export async function verifyTelegramCode(
  username: string,
  code: string,
): Promise<void> {
  const data = await telegramPost("verify", { username, code });
  if (!data.session) throw new Error("The server did not return a session.");
  const { error } = await supabase.auth.setSession(data.session);
  if (error) throw error;
}
