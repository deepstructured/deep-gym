import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "@deepgym/core/types";

import { useUpdateProfile } from "../data/queries";
import { useAuth } from "../providers/auth-provider";
import {
  DEFAULT_LAYOUT,
  normalizeLayout,
  type HomeLayout,
} from "@deepgym/core/home-layout";

export {
  DEFAULT_LAYOUT,
  newWidgetId,
  normalizeLayout,
  WIDGETS,
  WIDGET_TYPES,
} from "@deepgym/core/home-layout";
export type {
  HomeLayout,
  HomeWidget,
  WidgetSize,
  WidgetType,
} from "@deepgym/core/home-layout";

const STORAGE_PREFIX = "deepgym-home-layout:";

interface StoredLayout {
  version: 1;
  layout: HomeLayout | null;
  /** The local choice has not yet been acknowledged by the profile write. */
  pending: boolean;
  /** Server layout seen when this local edit was made. */
  baseRemote?: string;
}

interface LocalLayout {
  userId: string;
  hydrated: boolean;
  present: boolean;
  layout: HomeLayout | null;
  pending: boolean;
  baseRemote?: string;
}

function readStored(raw: string | null): Pick<LocalLayout, "present" | "layout" | "pending" | "baseRemote"> {
  if (!raw) return { present: false, layout: null, pending: false };
  const parsed: unknown = JSON.parse(raw);
  if (parsed && typeof parsed === "object" && "layout" in parsed) {
    const record = parsed as Partial<StoredLayout>;
    const layout = record.layout == null ? null : normalizeLayout(record.layout);
    if (record.layout != null && !layout) {
      return { present: false, layout: null, pending: false };
    }
    return { present: true, layout, pending: record.pending !== false,
      baseRemote: typeof record.baseRemote === "string" ? record.baseRemote : undefined };
  }

  // Accept a plain layout saved by an earlier mobile build.
  const legacy = normalizeLayout(parsed);
  return legacy
    ? { present: true, layout: legacy, pending: true }
    : { present: false, layout: null, pending: false };
}

function hasRemoteLayoutColumn(profile: Profile | null | undefined): profile is Profile {
  return Boolean(profile && Object.prototype.hasOwnProperty.call(profile, "home_widgets"));
}

/**
 * A per-account dashboard layout. Pending local choices win over stale profile
 * fetches; when migration 0008 has not been applied, AsyncStorage remains the
 * durable source and no unsupported column is sent to Supabase.
 */
export function useMobileHomeLayout(profile: Profile | null | undefined): {
  layout: HomeLayout;
  isCustom: boolean;
  save: (next: HomeLayout) => void;
  reset: () => void;
  saving: boolean;
  error: boolean;
} {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const userId = profile && user && profile.id === user.id ? profile.id : null;
  const remoteAvailable = hasRemoteLayoutColumn(profile);
  const remoteLayout = remoteAvailable && profile
    ? normalizeLayout(profile.home_widgets)
    : null;
  const remoteFingerprint = JSON.stringify(remoteLayout);
  const [local, setLocal] = useState<LocalLayout | null>(null);
  const [savingCount, setSavingCount] = useState(0);
  const [error, setError] = useState(false);
  const activeUserRef = useRef(userId);
  const latestByUserRef = useRef(new Map<string, number>());
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const retryAttemptRef = useRef<string | null>(null);
  const mutateRef = useRef(updateProfile.mutateAsync);
  activeUserRef.current = userId;
  mutateRef.current = updateProfile.mutateAsync;

  useEffect(() => {
    retryAttemptRef.current = null;
    setSavingCount(0);
    setError(false);
    if (!userId) {
      setLocal(null);
      return;
    }

    let active = true;
    const initialSequence = latestByUserRef.current.get(userId) ?? 0;
    void AsyncStorage.getItem(STORAGE_PREFIX + userId)
      .then((raw) => {
        if (!active || activeUserRef.current !== userId) return;
        if ((latestByUserRef.current.get(userId) ?? 0) !== initialSequence) return;
        setLocal({ userId, hydrated: true, ...readStored(raw) });
      })
      .catch(() => {
        if (!active || activeUserRef.current !== userId) return;
        if ((latestByUserRef.current.get(userId) ?? 0) !== initialSequence) return;
        setLocal({ userId, hydrated: true, present: false, layout: null, pending: false });
        setError(true);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const persist = useCallback(
    (next: HomeLayout | null, baseRemote = remoteFingerprint) => {
      if (!userId) return;
      const normalized = next === null ? null : normalizeLayout(next);
      if (next !== null && !normalized) {
        setError(true);
        return;
      }

      const sequence = (latestByUserRef.current.get(userId) ?? 0) + 1;
      latestByUserRef.current.set(userId, sequence);
      retryAttemptRef.current = `${userId}:${JSON.stringify(normalized)}:${baseRemote}`;
      setLocal({ userId, hydrated: true, present: true, layout: normalized, pending: true, baseRemote });
      setError(false);
      setSavingCount((count) => count + 1);

      // Serialized writes keep rapid drag/hide actions in their chosen order.
      const run = async () => {
        let failed = false;
        const key = STORAGE_PREFIX + userId;
        const record: StoredLayout = { version: 1, layout: normalized, pending: true, baseRemote };
        try {
          await AsyncStorage.setItem(key, JSON.stringify(record));
        } catch {
          failed = true;
        }

        if (remoteAvailable && activeUserRef.current === userId) {
          try {
            await mutateRef.current({ home_widgets: normalized });
            const queryKey = ["profile", userId];
            await queryClient.cancelQueries({ queryKey, exact: true });
            queryClient.setQueryData<Profile>(queryKey, (current) =>
              current ? { ...current, home_widgets: normalized } : current,
            );
            void queryClient.invalidateQueries({ queryKey, exact: true });

            if (latestByUserRef.current.get(userId) === sequence) {
              try {
                await AsyncStorage.removeItem(key);
              } catch {
                failed = true;
              }
              if (activeUserRef.current === userId && !failed) {
                setLocal({ userId, hydrated: true, present: false, layout: null, pending: false });
              }
            }
          } catch {
            failed = true;
          }
        }

        if (activeUserRef.current === userId) {
          if (latestByUserRef.current.get(userId) === sequence) setError(failed);
          setSavingCount((count) => Math.max(0, count - 1));
        }
      };

      const queued = queueRef.current.then(run, run);
      queueRef.current = queued.catch(() => undefined);
    },
    [queryClient, remoteAvailable, remoteFingerprint, userId],
  );

  const activeLocal = local?.userId === userId && local.hydrated ? local : null;
  const localWins = Boolean(activeLocal?.present && (!remoteAvailable ||
    (activeLocal.pending && (activeLocal.baseRemote === remoteFingerprint || savingCount > 0))));
  const layout = localWins ? activeLocal?.layout ?? DEFAULT_LAYOUT : remoteLayout ?? DEFAULT_LAYOUT;
  const isCustom = localWins ? activeLocal?.layout !== null : remoteLayout !== null;

  useEffect(() => {
    if (!userId || !remoteAvailable || !activeLocal?.present || !activeLocal.pending) return;
    if (savingCount > 0) return;
    const fingerprint = `${userId}:${JSON.stringify(activeLocal.layout)}:${remoteFingerprint}`;
    if (retryAttemptRef.current === fingerprint) return;
    if (JSON.stringify(activeLocal.layout) === remoteFingerprint ||
      (activeLocal.baseRemote !== remoteFingerprint && !(activeLocal.baseRemote === undefined && remoteLayout === null))) {
      // Another device changed the profile after this local edit (or an old
      // build left a pending copy with no baseline). Keep the server's choice.
      retryAttemptRef.current = fingerprint;
      setLocal({ userId, hydrated: true, present: false, layout: null, pending: false });
      void AsyncStorage.removeItem(STORAGE_PREFIX + userId).catch(() => {});
      return;
    }
    retryAttemptRef.current = fingerprint;
    persist(activeLocal.layout, activeLocal.baseRemote ?? remoteFingerprint);
  }, [activeLocal, persist, remoteAvailable, remoteFingerprint, remoteLayout, savingCount, userId]);

  return {
    layout,
    isCustom,
    save: (next) => persist(next),
    reset: () => persist(null),
    saving: savingCount > 0,
    error,
  };
}
