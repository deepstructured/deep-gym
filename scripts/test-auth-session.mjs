import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { QueryClient } from "@tanstack/react-query";

async function loadSource(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const { createAuthSessionStore } = await loadSource("../src/shared/lib/auth-session-store.ts");
const { withTimeout } = await loadSource("../src/shared/lib/request-timeout.ts");

test("switching accounts clears cached personal data before the new identity is published", () => {
  const store = createAuthSessionStore();
  const client = new QueryClient();
  store.sessionChanged("athlete-a");
  client.setQueryData(["profile", "athlete-a"], { id: "athlete-a", display_name: "Private A" });
  client.setQueryData(["legacy-unscoped-query"], "A's private data");
  store.subscribeIdentityChange(() => { void client.cancelQueries(); client.clear(); });
  store.subscribe(() => assert.equal(client.getQueryCache().getAll().length, 0));
  store.sessionChanged("athlete-b");
  assert.equal(store.getSnapshot().userId, "athlete-b");
});

test("a same-user token refresh keeps warm query data", () => {
  const store = createAuthSessionStore();
  let clears = 0;
  store.subscribeIdentityChange(() => { clears++; });
  store.sessionChanged("athlete-a");
  store.sessionChanged("athlete-a");
  assert.equal(clears, 1);
});

test("a late initial session cannot resurrect an account after sign-out", () => {
  const store = createAuthSessionStore();
  const attempt = store.beginResolution();
  store.sessionChanged(null);
  store.resolve(attempt, "old-athlete");
  assert.equal(store.getSnapshot().status, "unauthenticated");
  assert.equal(store.getSnapshot().userId, null);
});

test("a stale init failure cannot replace a newer sign-in", () => {
  const store = createAuthSessionStore();
  const attempt = store.beginResolution();
  store.sessionChanged("athlete-b");
  store.resolve(attempt, null, new Error("Old request failed"));
  assert.equal(store.getSnapshot().status, "authenticated");
  assert.equal(store.getSnapshot().userId, "athlete-b");
});

test("an auth deadline produces a terminal error and ignores the later result", async () => {
  const store = createAuthSessionStore();
  const attempt = store.beginResolution();
  let finish;
  const slow = new Promise((resolve) => { finish = resolve; });
  await withTimeout(async (signal) => {
    const result = await slow;
    signal.throwIfAborted();
    return result;
  }, 5).then(
    (userId) => store.resolve(attempt, userId),
    (error) => store.resolve(attempt, null, error),
  );
  assert.equal(store.getSnapshot().status, "error");
  finish("stale-athlete");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.getSnapshot().status, "error");
  assert.equal(store.getSnapshot().userId, null);
  const retry = store.beginResolution();
  store.resolve(retry, "athlete-a");
  assert.equal(store.getSnapshot().status, "authenticated");
});

test("a cancelled query cannot repopulate the cache after an identity change", async () => {
  const store = createAuthSessionStore();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  store.sessionChanged("athlete-a");
  store.subscribeIdentityChange(() => { void client.cancelQueries(); client.clear(); });
  let resolveQuery;
  const deferred = new Promise((resolve) => { resolveQuery = resolve; });
  const pending = client.fetchQuery({ queryKey: ["profile", "athlete-a"], queryFn: () => deferred }).catch(() => undefined);
  store.sessionChanged("athlete-b");
  resolveQuery({ id: "athlete-a", display_name: "Private A" });
  await pending;
  assert.equal(client.getQueryCache().getAll().length, 0);
});
