import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const authStorageKey = `sb-${new URL(url || "https://unconfigured.supabase.co").hostname.split(".")[0]}-auth-token`;

/** Only the public anon key belongs in an Expo bundle. RLS protects user data. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(
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
