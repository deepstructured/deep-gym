export type AuthSessionStatus = "loading" | "authenticated" | "unauthenticated" | "error";
export interface AuthSessionSnapshot {
  userId: string | null;
  status: AuthSessionStatus;
  error: Error | null;
}

export const INITIAL_AUTH_SESSION: AuthSessionSnapshot = {
  userId: null,
  status: "loading",
  error: null,
};

/** Session identity is a UI/cache boundary; database access still relies on RLS. */
export function createAuthSessionStore() {
  let snapshot = INITIAL_AUTH_SESSION;
  let generation = 0;
  const listeners = new Set<() => void>();
  const identityListeners = new Set<(userId: string | null) => void>();

  function publish(next: AuthSessionSnapshot) {
    if (snapshot.userId !== next.userId) {
      // Remove the previous account's cache/drafts before notifying any view.
      identityListeners.forEach((listener) => listener(next.userId));
    }
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    subscribeIdentityChange(listener: (userId: string | null) => void) {
      identityListeners.add(listener);
      return () => { identityListeners.delete(listener); };
    },
    beginResolution() {
      const attempt = ++generation;
      publish({ ...snapshot, status: "loading", error: null });
      return attempt;
    },
    resolve(attempt: number, userId: string | null, error: Error | null = null) {
      if (attempt !== generation) return;
      ++generation;
      publish({ userId, status: error ? "error" : userId ? "authenticated" : "unauthenticated", error });
    },
    sessionChanged(userId: string | null) {
      ++generation;
      publish({ userId, status: userId ? "authenticated" : "unauthenticated", error: null });
    },
  };
}
