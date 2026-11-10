import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../packages/core/src/backend-data-client.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function("exports", compiled)(exports);
const { createBackendDataClient } = exports;
const user = "11111111-1111-1111-1111-111111111111";
function fixture(reply = { data: [], count: 0, error: null }) {
  const requests = [];
  const client = createBackendDataClient(async (...args) => { requests.push(args); return reply; }, () => user);
  return { client, requests };
}

test("history filtering and exact pagination survive the compatibility boundary", async () => {
  const { client, requests } = fixture({ data: [{ id: "workout" }], count: 1003, error: null });
  const controller = new AbortController();
  const reply = await client.from("workouts").select("id,date,type", { count: "exact" }).eq("user_id", user)
    .gte("date", "2026-01-01").lte("date", "2026-11-10").order("date", { ascending: false })
    .range(500, 999).abortSignal(controller.signal);
  assert.equal(reply.count, 1003);
  assert.deepEqual(requests, [["workouts.headers", { count: true, offset: 500, limit: 500, from: "2026-01-01", to: "2026-11-10" }, controller.signal]]);
});

test("old native nested workout reads request complete domain records", async () => {
  const { client, requests } = fixture();
  await client.from("workouts").select("*, workout_exercises (*, exercise:exercises (*), sets (*))").order("date", { ascending: false });
  assert.equal(requests[0][0], "workouts.list");
  assert.equal(requests[0][1].limit, undefined);
});

test("atomic retry key and draft ownership are retained", async () => {
  const { client, requests } = fixture({ data: [{ draft: {}, updated_at: "now" }], error: null });
  const payload = { type: "A", exercises: [] };
  await client.rpc("save_workout_atomic", { p_input: payload, p_workout_id: null, p_create_key: "retry-key" });
  const result = await client.rpc("save_workout_draft", { p_owner_id: user, p_draft: {}, p_updated_at: "now" }).single();
  assert.deepEqual(requests[0].slice(0, 2), ["workouts.save", { input: payload, id: null, createKey: "retry-key" }]);
  assert.equal(requests[1][1].ownerId, user);
  assert.equal(result.data.updated_at, "now");
});

test("wrong-account writes and unknown predicates never reach the server", async () => {
  const { client, requests } = fixture();
  assert.ok((await client.from("profiles").update({ language: "en" }).eq("id", "another-user")).error);
  assert.ok((await client.from("workouts").select("*").eq("unknown_field", "x")).error);
  assert.ok((await client.from("auth.users").select("*")).error);
  assert.equal(requests.length, 0);
});

test("optional missing drafts, required missing profile, count-only and API errors keep distinct outcomes", async () => {
  const empty = fixture({ data: null, count: 0, error: null });
  assert.equal((await empty.client.from("workout_drafts").select("*").maybeSingle()).error, null);
  assert.equal((await empty.client.from("profiles").select("*").single()).error.code, "PGRST116");
  const counted = fixture({ data: 12, count: 12, error: null });
  assert.deepEqual(await counted.client.from("workouts").select("id", { count: "exact", head: true }), { data: null, count: 12, error: null });
  const failed = fixture({ data: null, error: { code: "DATABASE_UNAVAILABLE", message: "Retry" } });
  assert.equal((await failed.client.from("exercises").select("*")).error.code, "DATABASE_UNAVAILABLE");
});

test("a chained query awaited twice sends one request and pre-aborted calls send none", async () => {
  const { client, requests } = fixture();
  const query = client.from("exercises").select("*");
  await Promise.all([query, query]);
  assert.equal(requests.length, 1);
  await assert.rejects(Promise.resolve(client.from("exercises").select("*").abortSignal(AbortSignal.abort())), /abort/i);
  assert.equal(requests.length, 1);
});
