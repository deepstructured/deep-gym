"use client";

import { useSyncExternalStore } from "react";
import { SUPABASE_URL } from "@/shared/config/env";
import { getSupabaseBrowser } from "./supabase/client";
import { fetchWithTimeout, withTimeout } from "./request-timeout";
import { createAuthSessionStore, INITIAL_AUTH_SESSION } from "./auth-session-store";

const store = createAuthSessionStore();
let started = false;

export const getAuthSessionSnapshot = store.getSnapshot;
export const subscribeAuthIdentityChange = store.subscribeIdentityChange;

export function retryAuthSession(): void {
  const attempt = store.beginResolution();
  void withTimeout(async (signal) => {
    const { data, error } = await getSupabaseBrowser().auth.getSession();
    signal.throwIfAborted();
    if (error) throw error;
    return data.session?.user?.id ?? null;
  }).then(
    (userId) => store.resolve(attempt, userId),
    (error: unknown) => store.resolve(attempt, null, error instanceof Error ? error : new Error("Session unavailable")),
  );
}

function start() {
  if (started) return;
  started = true;
  // Never await a Supabase call inside this callback. It can run while the
  // client's internal auth lock is held, and also fires in other tabs.
  getSupabaseBrowser().auth.onAuthStateChange((event, session) => {
    // Initialization can emit null after a refresh failure. The explicit
    // bounded getSession call distinguishes that error from a signed-out user.
    if (event === "INITIAL_SESSION") return;
    store.sessionChanged(session?.user?.id ?? null);
  });
  retryAuthSession();
}

function subscribe(listener: () => void) {
  const unsubscribe = store.subscribe(listener);
  start();
  return unsubscribe;
}

export function useAuthSession() {
  return useSyncExternalStore(subscribe, store.getSnapshot, () => INITIAL_AUTH_SESSION);
}

export function requireAuthUserId(): string {
  const session = store.getSnapshot();
  if (session.status !== "authenticated" || !session.userId) throw new Error("Not signed in");
  return session.userId;
}

/** Recovery must work even when Auth or the SDK's refresh lock is unavailable. */
export function resetLocalAuthSession(): void {
  if (process.env.NEXT_PUBLIC_BACKEND === "postgres") {
    getSupabaseBrowser().auth.stopAutoRefresh();
    void fetchWithTimeout("/api/auth/session", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "reset" }),
    }).then((response) => {
      if (!response.ok) throw new Error("Reset unavailable");
      store.sessionChanged(null);
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("deepgym-auth-events");
        channel.postMessage({ event: "SIGNED_OUT" }); channel.close();
      }
      window.location.replace("/login");
    }).catch(() => window.location.replace("/login?error=unavailable"));
    return;
  }
  const prefix = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  const belongsToSession = (key: string) => key === prefix || key.startsWith(`${prefix}.`) || key.startsWith(`${prefix}-`);
  getSupabaseBrowser().auth.stopAutoRefresh();
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (belongsToSession(name)) document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  try {
    Object.keys(localStorage).filter(belongsToSession).forEach((key) => localStorage.removeItem(key));
  } catch {
    // Cookie-backed sessions can still be reset when Web Storage is blocked.
  }
  store.sessionChanged(null);
  window.location.replace("/login");
}
