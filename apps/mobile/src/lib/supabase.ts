import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { createBackendClient } from "@deepgym/core/backend-auth-client";
import { credentialStorage } from "./credential-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const postgres = process.env.EXPO_PUBLIC_BACKEND === "postgres";
const apiOrigin = (process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const authStorageKey = postgres ? `deepgym-auth:${apiOrigin}` : `sb-${new URL(url || "https://unconfigured.supabase.co").hostname.split(".")[0]}-auth-token`;

/** Only the public anon key belongs in an Expo bundle. RLS protects user data. */
export const isSupabaseConfigured = postgres ? Boolean(process.env.EXPO_PUBLIC_WEB_URL) : Boolean(url && anonKey);

export const supabase: SupabaseClient = postgres ? createBackendClient({
  origin: apiOrigin,
  native: Platform.OS !== "web",
  storage: credentialStorage,
  async createPkce() {
    const bytes = await Crypto.getRandomBytesAsync(32);
    const verifier = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
    return { verifier, challenge: digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") };
  },
  async fetcher(input, init) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const parent = init?.signal;
    if (parent?.aborted) controller.abort();
    else parent?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 12_000);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      // Consume the bounded response before releasing the deadline. The small
      // API replies then remain available to the normal response.json callers.
      const body = await response.arrayBuffer();
      return new Response([204, 205, 304].includes(response.status) ? null : body,
        { status: response.status, statusText: response.statusText, headers: response.headers });
    } finally { clearTimeout(timer); parent?.removeEventListener("abort", abort); }
  },
}) as unknown as SupabaseClient : createClient(
  url || "https://unconfigured.supabase.co",
  anonKey || "unconfigured-public-key",
  {
    auth: {
      storage: Platform.OS === "web" ? undefined : AsyncStorage,
      storageKey: authStorageKey,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);
