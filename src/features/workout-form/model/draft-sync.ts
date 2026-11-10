"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuthSession } from "@/shared/lib/auth-session";
import { withTimeout } from "@/shared/lib/request-timeout";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { syncDraftOwner, useNewWorkoutDraft, type WorkoutDraft } from "./draft";
import { draftStorage } from "./draft-storage";
import {
  canApplyRemote,
  createLatestWriteQueue,
  draftSignature,
  draftContentSignature,
  type DraftSnapshot,
} from "./draft-sync-engine";

const PUSH_DELAY_MS = 800;
const PULL_TIMEOUT_MS = 2500;

interface RemoteDraftRow {
  draft: WorkoutDraft;
  updated_at: string;
}
interface PendingDraft extends DraftSnapshot<WorkoutDraft> {
  ownerId: string;
  updatedAt: string;
}

const lastSynced = new Map<string, string>();
const syncFailures = new Set<string>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

function markSyncFailure(ownerId: string, failed: boolean) {
  if (syncFailures.has(ownerId) === failed) return;
  if (failed) syncFailures.add(ownerId);
  else syncFailures.delete(ownerId);
  listeners.forEach((listener) => listener());
}

function applyRemote(ownerId: string, startedSignature: string, remote: RemoteDraftRow) {
  const current = useNewWorkoutDraft.getState();
  lastSynced.set(ownerId, draftSignature({ draft: remote.draft, updatedAt: remote.updated_at }));
  if (current.ownerId !== ownerId || draftSignature(current) !== startedSignature) return;
  const differs = draftContentSignature(current.draft) !== draftContentSignature(remote.draft);
  if (current.updatedAt && differs) {
    // Preserve both copies, including a remote empty tombstone after another
    // device saved the workout. Never silently overwrite unsynced local work.
    useNewWorkoutDraft.setState({ pendingRemote: { draft: remote.draft, updatedAt: remote.updated_at } });
  } else if (canApplyRemote(current, ownerId, startedSignature, remote.updated_at) ||
    (!differs && remote.draft.createKey && remote.draft.createKey !== current.draft.createKey)) {
    useNewWorkoutDraft.setState({ draft: remote.draft, updatedAt: remote.updated_at });
  }
}

// This queue survives navigation. A delayed write from the old form cannot
// arrive after the reset/tombstone written by its replacement. The RPC also
// orders requests from other tabs/devices atomically (migration 0011).
const writes = createLatestWriteQueue<PendingDraft>(async (snapshot) => {
  const current = useNewWorkoutDraft.getState();
  if (current.ownerId !== snapshot.ownerId || current.pendingRemote) return;
  const signature = draftSignature(snapshot);
  if (lastSynced.get(snapshot.ownerId) === signature) return;
  try {
    const { data, error } = await withTimeout((signal) =>
      getSupabaseBrowser().rpc("save_workout_draft", {
        p_owner_id: snapshot.ownerId,
        p_draft: snapshot.draft,
        p_updated_at: snapshot.updatedAt,
      }).abortSignal(signal).single(),
    );
    if (error) throw error;
    if (!data) throw new Error("Draft sync returned no row");
    applyRemote(snapshot.ownerId, signature, data as RemoteDraftRow);
    markSyncFailure(snapshot.ownerId, false);
  } catch {
    // Keep the exact local draft/idempotency key. Never fall back to an
    // unordered upsert or delete if the migration is missing or RPC times out.
    markSyncFailure(snapshot.ownerId, true);
  }
});

function pushCurrent(ownerId: string) {
  const { draft, ownerId: currentOwner, updatedAt, pendingRemote } = useNewWorkoutDraft.getState();
  if (currentOwner !== ownerId || !updatedAt || pendingRemote) return;
  void writes.enqueue({ draft, ownerId, updatedAt });
}

/** Before saving, persist the shared idempotency key. A delayed prior write
 * cannot erase it because this preflight uses the same queue as autosave. */
export async function flushWorkoutDraftBeforeSave(ownerId: string): Promise<void> {
  const snapshot = useNewWorkoutDraft.getState();
  if (snapshot.ownerId !== ownerId || !snapshot.updatedAt || snapshot.pendingRemote || !snapshot.draft.createKey) {
    throw new Error("Draft is not ready to sync");
  }
  const signature = draftSignature(snapshot);
  await writes.enqueue({ ownerId, draft: snapshot.draft, updatedAt: snapshot.updatedAt });
  const current = useNewWorkoutDraft.getState();
  if (current.ownerId !== ownerId || current.pendingRemote || draftSignature(current) !== signature ||
    lastSynced.get(ownerId) !== signature || syncFailures.has(ownerId)) {
    throw new Error("Draft changed or cloud sync is unavailable");
  }
}

/** Auth initialization has its own bounded recovery state. Once identity is
 * known, local edits become usable after at most 2.5s, even if Auth/DB stops
 * responding. No second auth.getUser() sits outside that deadline. */
export function useNewWorkoutDraftSync(): { ready: boolean; syncError: boolean; storageError: boolean } {
  const { userId, status } = useAuthSession();
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const syncError = useSyncExternalStore(
    subscribe,
    () => Boolean(userId && syncFailures.has(userId)),
    () => false,
  );
  const storageError = useSyncExternalStore(draftStorage.subscribe, draftStorage.getSnapshot, () => false);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    syncDraftOwner(userId);
    setReadyFor(null);
    const controller = new AbortController();
    const startedSignature = draftSignature(useNewWorkoutDraft.getState());
    void (async () => {
      try {
        const { data, error } = await withTimeout((signal) =>
          getSupabaseBrowser()
            .from("workout_drafts")
            .select("draft, updated_at")
            .eq("user_id", userId)
            .abortSignal(signal)
            .maybeSingle(),
          PULL_TIMEOUT_MS,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (error) throw error;
        if (data) applyRemote(userId, startedSignature, data as RemoteDraftRow);
        markSyncFailure(userId, false);
      } catch {
        if (!controller.signal.aborted) markSyncFailure(userId, true);
      } finally {
        if (!controller.signal.aborted) setReadyFor(userId);
      }
    })();
    return () => controller.abort();
  }, [status, userId]);

  const ready = status === "authenticated" && userId !== null && readyFor === userId;
  useEffect(() => {
    if (!ready || !userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previous = draftSignature(useNewWorkoutDraft.getState());
    const flush = () => {
      clearTimeout(timer);
      pushCurrent(userId);
    };
    const unsubscribe = useNewWorkoutDraft.subscribe((state) => {
      if (state.ownerId !== userId) return;
      const next = draftSignature(state);
      if (next === previous && state.pendingRemote) return;
      previous = next;
      clearTimeout(timer);
      timer = setTimeout(flush, PUSH_DELAY_MS);
    });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    // Retry existing unsynced edits on mount/reconnect; no new keystroke is
    // required after recovering from offline or a missing migration.
    flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      clearTimeout(timer);
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [ready, userId]);

  return { ready, syncError, storageError };
}
