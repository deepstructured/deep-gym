/** Web Storage may be blocked or full. Keep edits usable in memory and expose
 * the failure, rather than throwing inside the synchronous auth listener. */
export function createSafeDraftStorage(getStorage: () => Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined) {
  const memory = new Map<string, string>();
  const dirty = new Set<string>();
  const listeners = new Set<() => void>();
  let failed = false;
  const mark = (next: boolean) => {
    if (failed === next) return;
    failed = next;
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => failed,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    storage: {
      getItem(name: string): string | null {
        // A successful read of stale disk contents must not replace an edit
        // whose write failed, or incorrectly clear the persistence warning.
        if (dirty.has(name)) return memory.get(name) ?? null;
        try {
          const storage = getStorage();
          if (storage) {
            const value = storage.getItem(name);
            if (value !== null) memory.set(name, value);
            mark(dirty.size > 0);
            return value ?? memory.get(name) ?? null;
          }
        } catch { mark(true); }
        return memory.get(name) ?? null;
      },
      setItem(name: string, value: string): void {
        memory.set(name, value);
        try {
          const storage = getStorage();
          if (storage) { storage.setItem(name, value); dirty.delete(name); mark(dirty.size > 0); }
        } catch { dirty.add(name); mark(true); }
      },
      removeItem(name: string): void {
        memory.delete(name);
        try {
          const storage = getStorage();
          if (storage) { storage.removeItem(name); dirty.delete(name); mark(dirty.size > 0); }
        } catch { dirty.add(name); mark(true); }
      },
    },
  };
}

export const draftStorage = createSafeDraftStorage(() =>
  typeof window === "undefined" ? undefined : window.localStorage,
);
