import type { User } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { reloadAppAsync } from "expo";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";

import { authStorageKey, isSupabaseConfigured, supabase } from "../lib/supabase";
import { credentialStorage } from "../lib/credential-storage";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  resetLocalSession: () => Promise<void>;
  clearDeletedSession: (userId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const authStorageKeys = [authStorageKey, `${authStorageKey}-code-verifier`, `${authStorageKey}-user`, `${authStorageKey}:pkce`];

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const deletedUserId = useRef<string | null>(null);
  const resettingSession = useRef(false);
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;
    let sessionRevision = 0;
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION" && sessionRevision > 0) return;
        if (event !== "INITIAL_SESSION") sessionRevision++;
        if (active && !resettingSession.current) {
          const nextUser = session?.user?.id === deletedUserId.current ? null : session?.user ?? null;
          if (currentUserId.current !== (nextUser?.id ?? null)) {
            void queryClient.cancelQueries();
            queryClient.clear();
            currentUserId.current = nextUser?.id ?? null;
          }
          setUser(nextUser);
          setLoading(false);
        }
      },
    );

    const initialRevision = sessionRevision;
    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active || resettingSession.current || initialRevision !== sessionRevision) return;
        const resolvedUser = error ? null : (data.session?.user ?? null);
        setUser(resolvedUser?.id === deletedUserId.current ? null : resolvedUser);
        setLoading(false);
      })
      .catch(() => {
        if (!active || resettingSession.current || initialRevision !== sessionRevision) return;
        setUser(null);
        setLoading(false);
      });

    const appState =
      Platform.OS === "web"
        ? null
        : AppState.addEventListener("change", (state) => {
            if (state === "active") supabase.auth.startAutoRefresh();
            else supabase.auth.stopAutoRefresh();
          });

    if (Platform.OS !== "web" && AppState.currentState === "active") {
      supabase.auth.startAutoRefresh();
    }

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      appState?.remove();
      if (Platform.OS !== "web") supabase.auth.stopAutoRefresh();
    };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    if (process.env.EXPO_PUBLIC_BACKEND === "postgres") await credentialStorage.removeItem(`${authStorageKey}:pkce`);
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const resetLocalSession = useCallback(async () => {
    // Reset the own client's state directly. A legacy SDK lock may require a
    // production-capable reload after removing its persisted credentials.
    resettingSession.current = true;
    supabase.auth.stopAutoRefresh();
    const ownBackend = process.env.EXPO_PUBLIC_BACKEND === "postgres";
    try {
      if (ownBackend) {
        await (supabase.auth as unknown as { resetLocalSession(): Promise<void> }).resetLocalSession();
        await credentialStorage.removeItem(`${authStorageKey}:pkce`);
      } else {
        // Local sign-out may be waiting for the SDK lock. Give it a bounded
        // chance to clear memory, then remove persisted tokens and reload.
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve,1500);
          void supabase.auth.signOut({ scope: "local" }).then(() => {
            clearTimeout(timer); resolve();
          }, () => { clearTimeout(timer); resolve(); });
        });
      }
      if (Platform.OS === "web") {
        authStorageKeys.forEach((key) => globalThis.localStorage?.removeItem(key));
      } else {
        await AsyncStorage.multiRemove(authStorageKeys);
      }
      queryClient.clear();
      currentUserId.current = null;
      setUser(null);
      setLoading(false);
      // The own client resets its memory and generation itself. A new native
      // sign-in can proceed immediately without restarting the application.
      if (Platform.OS !== "web" && ownBackend) return;
      if (Platform.OS !== "web") await reloadAppAsync("Reset local authentication session");
      else globalThis.location?.reload();
    } catch (error) {
      throw error;
    } finally {
      resettingSession.current = false;
      if (ownBackend && Platform.OS !== "web" && AppState.currentState === "active") supabase.auth.startAutoRefresh();
    }
  }, [queryClient]);

  const clearDeletedSession = useCallback(async (userId: string) => {
    // The server already deleted the account. Network failure while revoking
    // its now-invalid token must not leave the device on an authenticated UI.
    deletedUserId.current = userId;
    supabase.auth.stopAutoRefresh();
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Remove persisted credentials below even if the auth endpoint is down.
    }
    try {
      if (process.env.EXPO_PUBLIC_BACKEND === "postgres") {
        await (supabase.auth as unknown as { resetLocalSession(): Promise<void> }).resetLocalSession();
        await credentialStorage.removeItem(`${authStorageKey}:pkce`);
      }
      if (Platform.OS === "web") authStorageKeys.forEach((key) => globalThis.localStorage?.removeItem(key));
      else await AsyncStorage.multiRemove(authStorageKeys);
    } catch {
      // The deleted identity is still hidden until the next app start.
    }
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, loading, signOut, resetLocalSession, clearDeletedSession }),
    [user, loading, signOut, resetLocalSession, clearDeletedSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
