import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/features/workout-form/model/draft-sync-engine.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createLatestWriteQueue, switchDraftOwner, nextDraftTimestamp, draftSignature, canApplyRemote } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const storageSource = await readFile(new URL("../src/features/workout-form/model/draft-storage.ts", import.meta.url), "utf8");
const storageCompiled = ts.transpileModule(storageSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createSafeDraftStorage } = await import(`data:text/javascript;base64,${Buffer.from(storageCompiled).toString("base64")}`);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test("a delayed edit finishes before the final empty tombstone; intermediate edits coalesce", async () => {
  const first = deferred();
  const started = deferred();
  const written = [];
  let inFlight = 0;
  const queue = createLatestWriteQueue(async snapshot => {
    assert.equal(++inFlight, 1);
    if (snapshot === "old edit") { started.resolve(); await first.promise; }
    written.push(snapshot);
    inFlight--;
  });
  queue.enqueue("old edit");
  await started.promise;
  queue.enqueue("intermediate edit");
  const settled = queue.enqueue("empty tombstone after save");
  assert.deepEqual(written, []);
  first.resolve();
  await settled;
  assert.deepEqual(written, ["old edit", "empty tombstone after save"]);
});

test("a failed in-flight write does not lose newer queued work", async () => {
  const first = deferred();
  const started = deferred();
  const written = [];
  const queue = createLatestWriteQueue(async snapshot => {
    if (snapshot === "old") { started.resolve(); await first.promise; }
    written.push(snapshot);
  });
  queue.enqueue("old");
  await started.promise;
  const settled = queue.enqueue("latest");
  first.reject(new Error("offline"));
  await settled;
  assert.deepEqual(written, ["latest"]);
});

test("sign-out and an account switch preserve each owner's draft and create key", () => {
  const a = { notes: "A private draft", createKey: "key-a" };
  const b = { notes: "B private draft", createKey: "key-b" };
  const empty = () => ({ notes: "" });
  let state = { draft: a, ownerId: "a", updatedAt: "2026-01-01T00:00:00.000Z", archivedDrafts: {}, unownedDraft: null };
  state = switchDraftOwner(state, null, empty);
  assert.deepEqual(state.draft, empty());
  state = switchDraftOwner(state, "b", empty);
  assert.deepEqual(state.draft, empty());
  state = { ...state, draft: b, updatedAt: "2026-01-02T00:00:00.000Z" };
  state = switchDraftOwner(state, "a", empty);
  assert.deepEqual(state.draft, a);
  assert.deepEqual(state.archivedDrafts.b.draft, b);
});

test("an unowned legacy draft is retained but never exposed to the next account", () => {
  const legacy = { notes: "unattributed" };
  const state = switchDraftOwner({ draft: legacy, ownerId: null, updatedAt: "2026-01-01T00:00:00.000Z", archivedDrafts: {}, unownedDraft: null }, "new-user", () => ({ notes: "" }));
  assert.equal(state.draft.notes, "");
  assert.deepEqual(state.unownedDraft.draft, legacy);
});

test("late reads cannot replace edits or a different account's draft", () => {
  const initial = { ownerId: "a", draft: { notes: "before" }, updatedAt: "2026-01-01T00:00:00.000Z" };
  const signature = draftSignature(initial);
  const remoteTime = "2026-01-02T00:00:00.000Z";
  assert.equal(canApplyRemote(initial, "a", signature, remoteTime), true);
  assert.equal(canApplyRemote({ ...initial, draft: { notes: "edited while waiting" } }, "a", signature, remoteTime), false);
  assert.equal(canApplyRemote({ ...initial, ownerId: "b" }, "a", signature, remoteTime), false);
});

test("edit timestamps remain monotonic after clock rollback and same-millisecond changes", () => {
  const previous = "2026-01-01T00:00:00.000Z";
  assert.equal(nextDraftTimestamp(previous, Date.parse(previous)), "2026-01-01T00:00:00.001Z");
  assert.equal(nextDraftTimestamp(previous, 0), "2026-01-01T00:00:00.001Z");
});

test("jsonb property ordering does not create a false sync difference", () => {
  assert.equal(draftSignature({ updatedAt: "x", draft: { a: 1, b: { c: 3, d: 4 } } }),
    draftSignature({ updatedAt: "x", draft: { b: { d: 4, c: 3 }, a: 1 } }));
});

test("Postgres timezone formatting acknowledges the same local snapshot", () => {
  assert.equal(draftSignature({ updatedAt: "2026-01-01T12:34:56.000Z", draft: { notes: "saved" } }),
    draftSignature({ updatedAt: "2026-01-01T12:34:56+00:00", draft: { notes: "saved" } }));
});

test("denied Web Storage cannot interrupt auth identity publication or lose in-memory edits", () => {
  const storage = createSafeDraftStorage(() => { throw new Error("SecurityError"); });
  let notifications = 0;
  storage.subscribe(() => notifications++);
  assert.doesNotThrow(() => storage.storage.setItem("draft", "private edits"));
  assert.equal(storage.storage.getItem("draft"), "private edits");
  assert.equal(storage.getSnapshot(), true);
  assert.equal(notifications, 1);
});

test("quota errors preserve the draft in memory and a later successful write clears the warning", () => {
  let full = true;
  const disk = new Map();
  const storage = createSafeDraftStorage(() => ({
    getItem: name => disk.get(name) ?? null,
    setItem: (name, value) => { if (full) throw new Error("QuotaExceededError"); disk.set(name, value); },
    removeItem: name => disk.delete(name),
  }));
  storage.storage.setItem("draft", "draft A");
  assert.equal(storage.getSnapshot(), true);
  assert.equal(storage.storage.getItem("draft"), "draft A");
  assert.equal(storage.getSnapshot(), true);
  full = false;
  storage.storage.setItem("draft", "draft B");
  assert.equal(disk.get("draft"), "draft B");
  assert.equal(storage.getSnapshot(), false);
});
