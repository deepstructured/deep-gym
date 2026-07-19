"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { isDraftEmpty, useNewWorkoutDraft, type WorkoutDraft } from "./draft";

const PUSH_DELAY_MS = 800;
const PULL_TIMEOUT_MS = 2500;

interface RemoteDraftRow {
  draft: WorkoutDraft;
  updated_at: string;
}

/** Cross-device sync for the new-workout draft. localStorage stays the
 *  instant/offline source of truth on each device; the `workout_drafts`
 *  row is the shared cloud copy. Conflicts resolve last-write-wins by the
 *  client-stamped edit time. Network failures are silent — the local
 *  draft keeps working and the next edit retries the push.
 *
 *  Returns `ready` once the initial pull settled (or timed out) — the
 *  form should render only after that so a fresher remote draft doesn't
 *  replace what the user is already looking at. */
export function useNewWorkoutDraftSync(): { ready: boolean } {
  const [ready, setReady] = useState(false);
  // Serialized draft that matches the cloud row — skip no-op pushes and
  // avoid echoing a pulled draft straight back.
  const lastSynced = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pull once on mount. A slow network must not hold the form hostage,
  // so the pull races a short timeout and the local draft wins the UI.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseBrowser();
        const result = await Promise.race([
          supabase
            .from("workout_drafts")
            .select("draft, updated_at")
            .maybeSingle(),
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), PULL_TIMEOUT_MS),
          ),
        ]);
        if (cancelled || !result || result.error || !result.data) return;
        const remote = result.data as RemoteDraftRow;
        const local = useNewWorkoutDraft.getState();
        const remoteIsNewer =
          !local.updatedAt ||
          new Date(remote.updated_at).getTime() >
            new Date(local.updatedAt).getTime();
        if (remoteIsNewer) {
          lastSynced.current = JSON.stringify(remote.draft);
          useNewWorkoutDraft.setState({
            draft: remote.draft,
            updatedAt: remote.updated_at,
          });
        }
      } catch {
        // Offline or table not reachable — local draft carries on.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Push local edits, debounced. An emptied draft deletes the cloud row.
  useEffect(() => {
    if (!ready) return;

    async function push() {
      const { draft, updatedAt } = useNewWorkoutDraft.getState();
      // Never edited on this device — nothing to publish, and pushing an
      // empty default here could wipe a draft made elsewhere.
      if (!updatedAt) return;
      const serialized = JSON.stringify(draft);
      if (serialized === lastSynced.current) return;
      try {
        const supabase = getSupabaseBrowser();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = isDraftEmpty(draft)
          ? await supabase
              .from("workout_drafts")
              .delete()
              .eq("user_id", user.id)
          : await supabase.from("workout_drafts").upsert({
              user_id: user.id,
              draft,
              updated_at: updatedAt,
            });
        if (!error) lastSynced.current = serialized;
      } catch {
        // Offline — the next edit or visit retries.
      }
    }

    function schedule() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void push(), PUSH_DELAY_MS);
    }

    // App backgrounded mid-edit (phone locked, tab switched) — flush now.
    function onVisibilityChange() {
      if (document.visibilityState !== "hidden") return;
      if (timer.current) clearTimeout(timer.current);
      void push();
    }

    const unsubscribe = useNewWorkoutDraft.subscribe(schedule);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer.current) clearTimeout(timer.current);
      void push();
    };
  }, [ready]);

  return { ready };
}
