import type { User } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  clearDeletedSession: (userId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const deletedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) {
          setUser(session?.user?.id === deletedUserId.current ? null : session?.user ?? null);
          setLoading(false);
        }
      },
    );

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      const resolvedUser = error ? null : (data.session?.user ?? null);
      setUser(resolvedUser?.id === deletedUserId.current ? null : resolvedUser);
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
    queryClient.clear();
    setUser(null);
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
      const keys = [authStorageKey, `${authStorageKey}-code-verifier`, `${authStorageKey}-user`];
      if (Platform.OS === "web") keys.forEach((key) => globalThis.localStorage?.removeItem(key));
      else await AsyncStorage.multiRemove(keys);
    } catch {
      // The deleted identity is still hidden until the next app start.
    }
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, loading, signOut, clearDeletedSession }),
    [user, loading, signOut, clearDeletedSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
