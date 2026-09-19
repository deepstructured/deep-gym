"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * A viewer-wide choice remembered in localStorage and shared live by every
 * component that reads it (e.g. the chart period). useSyncExternalStore keeps
 * the server snapshot on the fallback, so there is no hydration mismatch;
 * the stored value is applied right after mount.
 */
export function createStoredPreference<T extends string>(
  storageKey: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
) {
  const listeners = new Set<() => void>();
  let current: T = fallback;
  let loaded = false;

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function set(next: T) {
    if (next === current) return;
    current = next;
    listeners.forEach((listener) => listener());
  }

  return function usePreference(): [T, (next: T) => void] {
    const value = useSyncExternalStore(
      subscribe,
      () => current,
      () => fallback,
    );

    useEffect(() => {
      if (loaded) return;
      loaded = true;
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (isValid(stored)) set(stored);
      } catch {
        // storage unavailable — the fallback still works
      }
    }, []);

    const update = useCallback((next: T) => {
      set(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // not persisted in private mode
      }
    }, []);

    return [value, update];
  };
}
