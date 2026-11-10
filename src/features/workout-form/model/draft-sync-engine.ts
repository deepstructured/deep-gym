/** A browser may navigate away while a draft write is still in flight. Keep
 * one queue outside React so a remount cannot race the previous write. Pending
 * edits coalesce, but an in-flight write always settles before the next starts. */
export function createLatestWriteQueue<T>(write: (value: T) => Promise<void>) {
  let pending: { value: T } | undefined;
  let running: Promise<void> | undefined;

  async function drain() {
    while (pending) {
      const { value } = pending;
      pending = undefined;
      try {
        await write(value);
      } catch {
        // The writer reports failure. A later edit/reconnect may retry without
        // poisoning the queue or losing edits queued during this request.
      }
    }
  }

  function start(): Promise<void> {
    return running ??= Promise.resolve().then(drain).finally(() => {
      running = undefined;
      // An enqueue can arrive between drain resolving and this microtask.
      if (pending) void start();
    });
  }

  return {
    enqueue(value: T): Promise<void> {
      pending = { value };
      return start();
    },
  };
}

export interface DraftSnapshot<D> {
  draft: D;
  updatedAt: string | null;
}

export interface OwnedDraftState<D> extends DraftSnapshot<D> {
  ownerId: string | null;
  archivedDrafts: Record<string, DraftSnapshot<D>>;
  unownedDraft: DraftSnapshot<D> | null;
}

/** Preserve the previous athlete's edits without showing them to another one.
 * Legacy drafts without an owner are quarantined locally, never auto-claimed. */
export function switchDraftOwner<D>(
  state: OwnedDraftState<D>,
  ownerId: string | null,
  empty: () => D,
): OwnedDraftState<D> {
  if (state.ownerId === ownerId) return state;
  const archivedDrafts = { ...state.archivedDrafts };
  let unownedDraft = state.unownedDraft;
  const snapshot = { draft: state.draft, updatedAt: state.updatedAt };
  if (state.ownerId) archivedDrafts[state.ownerId] = snapshot;
  else if (state.updatedAt) unownedDraft = snapshot;
  const restored = ownerId ? archivedDrafts[ownerId] : undefined;
  if (ownerId) delete archivedDrafts[ownerId];
  return {
    draft: restored?.draft ?? empty(),
    updatedAt: restored?.updatedAt ?? null,
    ownerId,
    archivedDrafts,
    unownedDraft,
  };
}

/** Distinct edits must stay ordered even within a millisecond or after the
 * device clock moves backwards. The server uses this timestamp for ordering. */
export function nextDraftTimestamp(previous: string | null, now = Date.now()): string {
  const previousMs = previous ? Date.parse(previous) : NaN;
  return new Date(Math.max(now, Number.isFinite(previousMs) ? previousMs + 1 : now)).toISOString();
}

export function draftSignature<D>(snapshot: DraftSnapshot<D>): string {
  const parsed = snapshot.updatedAt ? Date.parse(snapshot.updatedAt) : NaN;
  const timestamp = Number.isFinite(parsed) ? new Date(parsed).toISOString() : snapshot.updatedAt ?? "";
  return `${timestamp}:${serializeDraft(snapshot.draft)}`;
}

export function serializeDraft(value: unknown): string {
  // jsonb returns keys in a different order from a locally built JS object.
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}

export function draftContentSignature<D extends { createKey?: string }>(draft: D): string {
  const { createKey: _key, ...content } = draft;
  return serializeDraft(content);
}

/** A late response cannot replace edits made while it was in flight. */
export function canApplyRemote<D>(
  current: DraftSnapshot<D> & { ownerId: string | null },
  ownerId: string,
  startedSignature: string,
  remoteUpdatedAt: string,
): boolean {
  return current.ownerId === ownerId &&
    draftSignature(current) === startedSignature &&
    Number.isFinite(Date.parse(remoteUpdatedAt)) &&
    (!current.updatedAt || Date.parse(remoteUpdatedAt) > Date.parse(current.updatedAt));
}
