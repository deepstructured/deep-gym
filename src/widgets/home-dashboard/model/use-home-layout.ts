"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useProfile, useUpdateProfile, type Profile } from "@/entities/user";
import {
  DEFAULT_LAYOUT,
  normalizeLayout,
  type HomeLayout,
} from "./layout";

const STORAGE_PREFIX = "deepgym-home-layout:";

/**
 * The user's home layout. The profile row (`profiles.home_widgets`) is the
 * synced source; localStorage mirrors it per user so the layout also works
 * before migration 0008 is applied or while offline. Saves are optimistic.
 */
export function useHomeLayout(): {
  layout: HomeLayout;
  isCustom: boolean;
  save: (layout: HomeLayout) => void;
  reset: () => void;
} {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const userId = profile?.id ?? null;
  const [local, setLocal] = useState<HomeLayout | null>(null);

  useEffect(() => {
    if (!userId) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_PREFIX + userId);
      setLocal(stored ? normalizeLayout(JSON.parse(stored)) : null);
    } catch {
      setLocal(null);
    }
  }, [userId]);

  const remote = normalizeLayout(profile?.home_widgets);
  const layout = remote ?? local ?? DEFAULT_LAYOUT;

  const persist = useCallback(
    (next: HomeLayout | null) => {
      if (!userId) return;
      setLocal(next);
      try {
        if (next) {
          window.localStorage.setItem(
            STORAGE_PREFIX + userId,
            JSON.stringify(next),
          );
        } else {
          window.localStorage.removeItem(STORAGE_PREFIX + userId);
        }
      } catch {
        // storage unavailable — the profile copy still syncs
      }
      queryClient.setQueryData<Profile | null>(["profile"], (current) =>
        current ? { ...current, home_widgets: next } : current,
      );
      // Fails harmlessly until the column exists; local copy keeps working.
      updateProfile.mutate({ home_widgets: next });
    },
    [queryClient, updateProfile, userId],
  );

  return {
    layout,
    isCustom: remote != null || local != null,
    save: persist,
    reset: () => persist(null),
  };
}
