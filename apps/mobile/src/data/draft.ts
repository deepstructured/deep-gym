import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Exercise } from "@deepgym/core/types";
import { kgToUnit, roundWeight, type Unit } from "@deepgym/core/weight";
import type { Equipment } from "@deepgym/core/workout";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/auth-provider";
import { localISO } from "../screens/format";

export interface DraftSet {
  key: string;
  weight: string;
  addedWeight?: string;
  reps: string;
  toFailure: boolean;
  warmup?: boolean;
}

export interface DraftExercise {
  key: string;
  exerciseId: string;
  name: string;
  muscleGroupName: string;
  equipment: Equipment;
  machineSettings: string | null;
  unit: Unit;
  notes: string;
  showNotes: boolean;
  sets: DraftSet[];
}

/** Matches the PWA's `workout_drafts.draft` JSON contract. */
export interface WorkoutDraft {
  type: string;
  date: string;
  bodyWeight: string;
  bodyWeightUnit?: Unit;
  bodyWeightAuto?: boolean;
  notes: string;
  showNotes: boolean;
  exercises: DraftExercise[];
  startedAt?: string;
  /** Stable idempotency key, shared with the cloud copy before native save. */
  createKey?: string;
}

interface DraftState {
  draft: WorkoutDraft;
  ownerId: string | null;
  updatedAt: string | null;
  draftsByOwner: Record<string, { draft: WorkoutDraft; updatedAt: string | null; createKey?: string }>;
  hydrated: boolean;
  syncReady: boolean;
  cloudVerified: boolean;
  pendingRemote: { ownerId: string; draft: WorkoutDraft; updatedAt: string } | null;
  selectOwner: (ownerId: string) => void;
  forgetOwner: (ownerId: string) => void;
  resolveConflict: (ownerId: string, useRemote: boolean) => void;
  replace: (draft: WorkoutDraft, ownerId: string, updatedAt: string) => void;
  edit: (ownerId: string, change: (draft: WorkoutDraft) => WorkoutDraft) => void;
  reset: (ownerId: string) => void;
}

export function emptyDraft(): WorkoutDraft {
  return {
    type: "Full Body",
    date: localISO(),
    bodyWeight: "",
    bodyWeightAuto: true,
    notes: "",
    showNotes: false,
    exercises: [],
  };
}

export function draftIsEmpty(draft: WorkoutDraft): boolean {
  return !draft.exercises.length && !draft.notes.trim();
}

function serializeDraft(draft: WorkoutDraft): string {
  // Postgres jsonb may return object keys in a different order.
  return JSON.stringify(draft, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value,
  );
}

function serializeDraftContent(draft: WorkoutDraft): string {
  const { createKey: _createKey, ...content } = draft;
  return serializeDraft(content);
}

function validCreateKey(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function withCreateKey(draft: WorkoutDraft, fallback?: string): WorkoutDraft {
  const createKey = validCreateKey(draft.createKey)
    ? draft.createKey
    : validCreateKey(fallback) ? fallback : Crypto.randomUUID();
  return draft.createKey === createKey ? draft : { ...draft, createKey };
}

// The save preflight and debounced sync must share one queue. Otherwise an
// older in-flight draft write could finish after the preflight and erase its key.
const draftWriteQueues = new Map<string, Promise<void>>();

function enqueueDraftWrite(userId: string, write: () => Promise<void>): Promise<void> {
  const previous = draftWriteQueues.get(userId) ?? Promise.resolve();
  const result = previous.then(write, write);
  const settled = result.then(() => undefined, () => undefined);
  draftWriteQueues.set(userId, settled);
  void settled.then(() => {
    if (draftWriteQueues.get(userId) === settled) draftWriteQueues.delete(userId);
  });
  return result;
}

export class DraftChangedBeforeSaveError extends Error {}

function nextDraftTimestamp(previous: string | null): string {
  const previousMs = previous ? Date.parse(previous) : NaN;
  return new Date(Math.max(Date.now(), Number.isFinite(previousMs) ? previousMs + 1 : 0)).toISOString();
}

/** Same atomic snapshot/tombstone protocol as the web app (migration 0011).
 * The outer deadline also bounds an SDK auth lock that ignores abortSignal. */
async function writeRemoteDraft(userId: string, draft: WorkoutDraft, updatedAt: string): Promise<void> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const { data, error } = await Promise.race([
      supabase.rpc("save_workout_draft", {
        p_owner_id: userId, p_draft: draft, p_updated_at: updatedAt,
      }).abortSignal(controller.signal).single(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("Draft sync timed out"));
        }, 12_000);
      }),
    ]);
    if (error) throw error;
    if (!data) throw new Error("Draft sync returned no row");
    const remote = data as { draft: WorkoutDraft; updated_at: string };
    if (serializeDraft(remote.draft) !== serializeDraft(draft) ||
      Date.parse(remote.updated_at) !== Date.parse(updatedAt)) {
      const current = useWorkoutDraft.getState();
      if (current.ownerId === userId && current.draft === draft) {
        useWorkoutDraft.setState({ cloudVerified: false, pendingRemote: {
          ownerId: userId, draft: remote.draft, updatedAt: remote.updated_at,
        } });
      }
      throw new DraftChangedBeforeSaveError("Another device has a newer draft");
    }
  } finally {
    clearTimeout(timeout);
  }
}

/** Confirm that the cloud copy carries this exact key before creating a workout. */
export async function flushWorkoutDraftBeforeSave(
  userId: string,
  expectedDraft: WorkoutDraft,
  expectedUpdatedAt: string | null,
): Promise<void> {
  if (!expectedUpdatedAt || !validCreateKey(expectedDraft.createKey) || draftIsEmpty(expectedDraft)) {
    throw new DraftChangedBeforeSaveError("Draft is not ready to save");
  }
  await enqueueDraftWrite(userId, async () => {
    const current = useWorkoutDraft.getState();
    if (
      current.ownerId !== userId ||
      !current.cloudVerified ||
      current.pendingRemote ||
      current.draft !== expectedDraft ||
      current.updatedAt !== expectedUpdatedAt
    ) {
      throw new DraftChangedBeforeSaveError("Draft changed before cloud sync");
    }
    await writeRemoteDraft(userId, expectedDraft, expectedUpdatedAt);
  });
}

export function createDraftSet(previous?: DraftSet): DraftSet {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    weight: previous?.weight ?? "",
    addedWeight: previous?.addedWeight,
    reps: previous?.reps ?? "",
    toFailure: false,
  };
}

export function exerciseToDraft(
  exercise: Exercise,
  muscleGroupName: string,
  defaultUnit: Unit,
  bodyWeightKg: number | null,
): DraftExercise {
  const unit = exercise.unit ?? defaultUnit;
  const weightKg =
    exercise.equipment === "bodyweight"
      ? bodyWeightKg
      : exercise.working_weight_kg;
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    exerciseId: exercise.id,
    name: exercise.name,
    muscleGroupName,
    equipment: exercise.equipment,
    machineSettings: exercise.machine_settings,
    unit,
    notes: "",
    showNotes: false,
    sets: [
      {
        ...createDraftSet(),
        weight: weightKg == null ? "" : String(roundWeight(kgToUnit(weightKg, unit))),
        addedWeight: exercise.equipment === "bodyweight" ? "0" : undefined,
      },
    ],
  };
}

export const useWorkoutDraft = create<DraftState>()(
  persist(
    (set, get) => ({
      draft: emptyDraft(),
      ownerId: null,
      updatedAt: null,
      draftsByOwner: {},
      hydrated: false,
      syncReady: false,
      cloudVerified: false,
      pendingRemote: null,
      selectOwner: (ownerId) => set((state) => {
        const saved = state.draftsByOwner[ownerId];
        const draft = withCreateKey(saved?.draft ?? emptyDraft(), saved?.createKey);
        const updatedAt = saved?.updatedAt ?? null;
        return {
          draft,
          ownerId,
          updatedAt,
          draftsByOwner: {
            ...state.draftsByOwner,
            [ownerId]: { draft, updatedAt, createKey: draft.createKey },
          },
          syncReady: false,
          cloudVerified: false,
          pendingRemote: null,
        };
      }),
      forgetOwner: (ownerId) => set((state) => {
        const { [ownerId]: _removed, ...draftsByOwner } = state.draftsByOwner;
        return {
          draftsByOwner,
          ...(state.ownerId === ownerId ? {
            draft: emptyDraft(),
            ownerId: null,
            updatedAt: null,
            syncReady: false,
            cloudVerified: false,
            pendingRemote: null,
          } : {}),
        };
      }),
      resolveConflict: (ownerId, useRemote) => set((state) => {
        const remote = state.pendingRemote;
        if (!remote || remote.ownerId !== ownerId || state.ownerId !== ownerId) return state;
        if (!useRemote) {
          const newer = remote.updatedAt > (state.updatedAt ?? "") ? remote.updatedAt : state.updatedAt;
          const updatedAt = nextDraftTimestamp(newer);
          return {
            pendingRemote: null, cloudVerified: true, updatedAt,
            draftsByOwner: { ...state.draftsByOwner, [ownerId]: {
              draft: state.draft, updatedAt, createKey: state.draft.createKey,
            } },
          };
        }
        const draft = withCreateKey(remote.draft, state.draftsByOwner[ownerId]?.createKey);
        return {
          pendingRemote: null,
          cloudVerified: true,
          draft,
          updatedAt: remote.updatedAt,
          draftsByOwner: {
            ...state.draftsByOwner,
            [ownerId]: { draft, updatedAt: remote.updatedAt, createKey: draft.createKey },
          },
        };
      }),
      replace: (draft, ownerId, updatedAt) =>
        set((state) => {
          const keyedDraft = withCreateKey(draft, state.draftsByOwner[ownerId]?.createKey);
          return {
            draft: keyedDraft, ownerId, updatedAt,
            draftsByOwner: {
              ...state.draftsByOwner,
              [ownerId]: {
                draft: keyedDraft,
                updatedAt,
                createKey: keyedDraft.createKey,
              },
            },
          };
        }),
      edit: (ownerId, change) =>
        set((state) => {
          const now = nextDraftTimestamp(state.ownerId === ownerId
            ? state.updatedAt : state.draftsByOwner[ownerId]?.updatedAt ?? null);
          const previous = state.ownerId === ownerId
            ? state.draft
            : state.draftsByOwner[ownerId]?.draft ?? emptyDraft();
          const next = change(previous);
          const draft = withCreateKey({
            ...next,
            createKey: previous.createKey,
            startedAt: draftIsEmpty(next)
              ? undefined
              : next.startedAt ?? previous.startedAt ?? now,
          }, state.draftsByOwner[ownerId]?.createKey);
          return {
            draft,
            ownerId,
            updatedAt: now,
            draftsByOwner: {
              ...state.draftsByOwner,
              [ownerId]: {
                draft,
                updatedAt: now,
                createKey: draft.createKey,
              },
            },
          };
        }),
      reset: (ownerId) => {
        set((state) => {
          const draft = withCreateKey(emptyDraft());
          const updatedAt = nextDraftTimestamp(state.ownerId === ownerId
            ? state.updatedAt : state.draftsByOwner[ownerId]?.updatedAt ?? null);
          return {
            draft, ownerId, updatedAt, pendingRemote: null,
            draftsByOwner: {
              ...state.draftsByOwner,
              [ownerId]: { draft, updatedAt, createKey: draft.createKey },
            },
          };
        });
        // Saving immediately navigates away. Do not depend on an 800ms effect
        // timer surviving that unmount to publish the empty tombstone.
        const snapshot = get();
        void enqueueDraftWrite(ownerId, async () => {
          if (get().ownerId !== ownerId) return;
          await writeRemoteDraft(ownerId, snapshot.draft, snapshot.updatedAt!);
        }).catch(() => { /* Local tombstone stays persisted for the next visit. */ });
      },
    }),
    {
      name: "deepgym-native-workout-draft",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted) => {
        const old = persisted as Partial<DraftState>;
        if (old.draftsByOwner) return { draftsByOwner: old.draftsByOwner };
        if (old.ownerId && old.draft) {
          return { draftsByOwner: {
            [old.ownerId]: { draft: old.draft, updatedAt: old.updatedAt ?? null },
          } };
        }
        return { draftsByOwner: {} };
      },
      partialize: ({ draftsByOwner }) => ({ draftsByOwner }),
      onRehydrateStorage: () => () =>
        useWorkoutDraft.setState({ hydrated: true }),
    },
  ),
);

/** Local draft opens immediately; newer cloud edits are pulled before editing. */
export function useWorkoutDraftSync(): { ready: boolean } {
  const { user } = useAuth();
  const { hydrated, draft, ownerId, updatedAt, selectOwner, pendingRemote } = useWorkoutDraft();
  const [ready, setReady] = useState(false);
  const [readOwner, setReadOwner] = useState<string | null>(null);
  const [verifiedOwner, setVerifiedOwner] = useState<string | null>(null);
  const lastSynced = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || !user) return;
    const userId = user.id;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;
    setReady(false);
    setReadOwner(null);
    setVerifiedOwner(null);
    lastSynced.current = null;
    useWorkoutDraft.setState({ syncReady: false, cloudVerified: false });
    selectOwner(userId);

    const revealTimer = setTimeout(() => {
      if (!cancelled) {
        setReady(true);
        useWorkoutDraft.setState({ syncReady: true });
      }
    }, 2500);

    async function pull() {
      if (cancelled || resolved) return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const result = await supabase
          .from("workout_drafts")
          .select("draft, updated_at")
          .eq("user_id", userId)
          .abortSignal(controller.signal)
          .maybeSingle();
        if (cancelled || resolved) return;
        if (result.error) throw result.error;
        resolved = true;
        const remote = result.data as { draft: WorkoutDraft; updated_at: string } | null;
        lastSynced.current = remote ? serializeDraft(remote.draft) : null;
        const current = useWorkoutDraft.getState();
        if (remote && current.ownerId === userId) {
          const differs = serializeDraftContent(current.draft) !== serializeDraftContent(remote.draft);
          if (current.updatedAt && differs) {
            // The local form may have changed while this read was in flight.
            // Keep both drafts until the user chooses which copy to retain.
            useWorkoutDraft.setState({ cloudVerified: false, pendingRemote: {
              ownerId: userId,
              draft: remote.draft,
              updatedAt: remote.updated_at,
            } });
          } else if (!current.updatedAt || (
            validCreateKey(remote.draft.createKey) && remote.draft.createKey !== current.draft.createKey
          )) {
            // A matching cloud draft may be from a save whose response was
            // lost. Its key takes precedence over a new device's local key.
            useWorkoutDraft.getState().replace(remote.draft, userId, remote.updated_at);
          }
        }
        setReadOwner(userId);
        clearTimeout(revealTimer);
        setReady(true);
        useWorkoutDraft.setState({ syncReady: true });
      } catch {
        // Keep editing locally; retry the read before any cloud write.
        if (!cancelled && !resolved) retryTimer = setTimeout(() => void pull(), 10_000);
      } finally {
        clearTimeout(timeout);
      }
    }
    void pull();
    return () => {
      cancelled = true;
      clearTimeout(revealTimer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [hydrated, user?.id, selectOwner]);

  useEffect(() => {
    if (readOwner === user?.id && !pendingRemote) {
      setVerifiedOwner(user.id);
      useWorkoutDraft.setState({ cloudVerified: true });
    }
  }, [readOwner, user?.id, pendingRemote]);

  useEffect(() => {
    if (!ready || !user || verifiedOwner !== user.id || !updatedAt || ownerId !== user.id) return;
    const serialized = serializeDraft(draft);
    if (serialized === lastSynced.current) return;
    const timer = setTimeout(() => {
      const run = async () => {
        const current = useWorkoutDraft.getState();
        if (
          current.ownerId !== user.id ||
          current.draft !== draft ||
          current.updatedAt !== updatedAt ||
          !current.cloudVerified ||
          current.pendingRemote
        ) return;
        try {
          await writeRemoteDraft(user.id, draft, updatedAt);
          if (useWorkoutDraft.getState().ownerId === user.id) {
            lastSynced.current = serialized;
          }
        } catch {
          // The next edit retries the cloud copy.
        }
      };
      void enqueueDraftWrite(user.id, run);
    }, 800);
    return () => clearTimeout(timer);
  }, [ready, verifiedOwner, user?.id, ownerId, updatedAt, draft]);

  return { ready: hydrated && ready };
}
