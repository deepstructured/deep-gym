import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadSource(relative, imports = {}) {
  const source = await readFile(new URL(relative, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("exports", "require", compiled)(exports, (name) => {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  });
  return exports;
}
const pagination = await loadSource("../src/shared/lib/supabase/pagination.ts");
const { readAllPages, readIdBatches } = pagination;
const { workoutRpcInput } = await loadSource("../src/entities/workout/api/workout-input.ts");

test("pagination exceeds 1000 rows even when server cap is smaller than requested page", async () => {
  const input = Array.from({ length: 1003 }, (_, id) => ({ id }));
  const calls = [];
  const output = await readAllPages(async ({ from, to, count }) => {
    calls.push({ from, to, count });
    return { data: input.slice(from, Math.min(to + 1, from + 13)), error: null, count: count ? input.length : null };
  });
  assert.deepEqual(output, input);
  assert.equal(calls[1].from, 13);
  assert.equal(calls.filter((call) => call.count === "exact").length, 1);
  assert.equal(calls.at(-1).from, 1001);
});

test("an exact page boundary does not make an out-of-range request", async () => {
  let requests = 0;
  const output = await readAllPages(async () => {
    requests++;
    return { data: [1, 2, 3], error: null, count: 3 };
  }, undefined, 3);
  assert.deepEqual(output, [1, 2, 3]);
  assert.equal(requests, 1);
});

test("without count, a short capped page is not treated as EOF", async () => {
  const rows = [1, 2, 3, 4, 5];
  const output = await readAllPages(async ({ from }) => ({ data: rows.slice(from, from + 2), error: null }));
  assert.deepEqual(output, rows);
});

test("a disappearing page rejects instead of reporting an incomplete successful history", async () => {
  await assert.rejects(readAllPages(async ({ from }) => ({
    data: from === 0 ? [1] : [], error: null, count: from === 0 ? 2 : null,
  })), /dataset changed/);
});

test("query cancellation stops pagination before the next request", async () => {
  const controller = new AbortController();
  let requests = 0;
  await assert.rejects(readAllPages(async () => {
    requests++;
    controller.abort();
    return { data: [1], error: null, count: 20 };
  }, controller.signal), { name: "AbortError" });
  assert.equal(requests, 1);
});

test("later query failure propagates instead of returning the first page", async () => {
  const failure = new Error("offline");
  await assert.rejects(readAllPages(async ({ from }) => from === 0
    ? { data: [1], error: null, count: 2 }
    : { data: null, error: failure }), (error) => error === failure);
});

test("IN batches deduplicate IDs, avoid empty requests and bound URL size", async () => {
  const requests = [];
  const ids = Array.from({ length: 107 }, (_, id) => String(id));
  const output = await readIdBatches([...ids, ...ids.slice(0, 10)], async (batch) => { requests.push(batch); return batch; });
  assert.deepEqual(output, ids);
  assert.deepEqual(requests.map((batch) => batch.length), [50, 50, 7]);
  assert.deepEqual(await readIdBatches([], async () => { throw new Error("must not fetch"); }), []);
});

test("workout hydration paginates child collections instead of trusting capped embeds", async () => {
  const occurrences = [
    { id: "e2", workout_id: "w1", exercise_id: "x2", position: 1 },
    { id: "e1", workout_id: "w1", exercise_id: "x1", position: 0 },
  ];
  const sets = Array.from({ length: 1003 }, (_, index) => ({
    id: `s${String(index).padStart(4, "0")}`, workout_exercise_id: index % 2 ? "e1" : "e2", position: 1003 - index,
  }));
  function builder(table) {
    let rows = table === "workout_exercises" ? occurrences : sets;
    let range = [0, 199];
    let includeCount;
    const query = {
      select(_fields, options) { includeCount = options?.count; return query; },
      in(field, ids) { rows = rows.filter((row) => ids.includes(row[field])); return query; },
      order(field) { rows = [...rows].sort((a, b) => a[field].localeCompare(b[field])); return query; },
      range(from, to) { range = [from, to]; return query; },
      abortSignal(signal) { signal.throwIfAborted(); return query; },
      then(resolve) { return Promise.resolve({ data: rows.slice(range[0], Math.min(range[1] + 1, range[0] + 7)), error: null, count: includeCount ? rows.length : null }).then(resolve); },
    };
    return query;
  }
  const { hydrateWorkouts } = await loadSource("../src/entities/workout/api/read-workouts.ts", {
    "@/shared/lib/supabase/client": { getSupabaseBrowser: () => ({ from: builder }) },
    "@/shared/lib/supabase/pagination": pagination,
  });
  const output = await hydrateWorkouts([{ id: "w1" }, { id: "w2" }], new AbortController().signal);
  assert.deepEqual(output[0].workout_exercises.map((row) => row.id), ["e1", "e2"]);
  assert.equal(output[0].workout_exercises.flatMap((row) => row.sets).length, 1003);
  assert.equal(output[0].workout_exercises[0].sets[0].position, 2);
  assert.deepEqual(output[1].workout_exercises, []);
});

test("atomic payload strips UI metadata and preserves omitted body-weight snapshots", () => {
  const input = {
    type: " Strength ", date: "2026-11-10", notes: null, createKey: "ui-only",
    exercises: [{ exercise_id: "e1", load_mode: "external", notes: null, name: "UI label", sets: [
      { weight_kg: 20, reps: 10, to_failure: true, set_type: "warmup", key: "local" },
      { weight_kg: 60, reps: 6, to_failure: true, set_type: "working" },
    ] }],
  };
  const result = workoutRpcInput(input);
  assert.equal(result.type, "Strength");
  assert.equal("createKey" in result, false);
  assert.equal("body_weight_kg" in result, false);
  assert.equal("name" in result.exercises[0], false);
  assert.equal("key" in result.exercises[0].sets[0], false);
  assert.equal(result.exercises[0].sets[0].to_failure, false);
  assert.equal(result.exercises[0].sets[1].to_failure, true);
  assert.equal(input.exercises[0].sets[0].to_failure, true);
  assert.equal(workoutRpcInput({ ...input, body_weight_kg: null }).body_weight_kg, null);
  assert.equal(workoutRpcInput({ ...input, body_weight_kg: 82.5 }).body_weight_kg, 82.5);
  assert.deepEqual(workoutRpcInput({ ...input, irrelevant: "changed" }), result);
});
