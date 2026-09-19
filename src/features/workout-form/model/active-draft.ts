"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useProfile } from "@/entities/user";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { isDraftEmpty, useNewWorkoutDraft, type WorkoutDraft } from "./draft";

export interface ActiveDraftSummary {
  type: string;
  exercises: number;
  /** Sets with at least a weight or reps entered. */
  filledSets: number;
  /** ISO timestamp of the first edit; null for drafts from older builds. */
  startedAt: string | null;
}

function summarize(draft: WorkoutDraft, fallbackStart: string | null) {
  if (isDraftEmpty(draft)) return null;
  const filledSets = draft.exercises.reduce(
    (sum, exercise) =>
      sum +
      exercise.sets.filter((set) => set.weight.trim() || set.reps.trim())
        .length,
    0,
  );
  return {
    type: draft.type,
    exercises: draft.exercises.length,
    filledSets,
    startedAt: draft.startedAt ?? fallbackStart,
  };
}

/**
 * The unsaved new-workout draft of the signed-in user, if any — from this
 * device (localStorage) or another one (the `workout_drafts` cloud row).
 * Last-write-wins like the draft sync: a newer local edit, including a reset
 * after saving, beats an older cloud copy. Null until mounted, so server and
 * client renders agree.
 */
export function useActiveWorkoutDraft(): ActiveDraftSummary | null {
  const { data: profile } = useProfile();
  const userId = profile?.id ?? null;
  const local = useNewWorkoutDraft();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const remote = useQuery({
    queryKey: ["workout-draft", userId],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("workout_drafts")
        .select("draft, updated_at")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as { draft: WorkoutDraft; updated_at: string } | null;
    },
    enabled: mounted && userId != null,
    staleTime: 15_000,
  });

  if (!mounted || !userId) return null;

  const localOwned = local.ownerId === userId;
  const remoteRow = remote.data ?? null;
  const localIsNewer =
    localOwned &&
    local.updatedAt != null &&
    (!remoteRow ||
      new Date(local.updatedAt).getTime() >=
        new Date(remoteRow.updated_at).getTime());

  if (localIsNewer || (localOwned && !remoteRow)) {
    return summarize(local.draft, local.updatedAt);
  }
  return remoteRow ? summarize(remoteRow.draft, remoteRow.updated_at) : null;
}
