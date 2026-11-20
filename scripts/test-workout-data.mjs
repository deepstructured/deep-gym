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
const pagination = await loadSource("../packages/core/src/pagination.ts");
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
  const { hydrateWorkouts } = await loadSource("../packages/core/src/workout-read.ts", { "./pagination": pagination });
  const output = await hydrateWorkouts({ from: builder }, [{ id: "w1" }, { id: "w2" }], new AbortController().signal);
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

test("both apps resolve fresh, restored and explicitly unassigned workout venues consistently", async () => {
  const { resolveWorkoutDraftGym } = await loadSource("../packages/core/src/workout.ts");
  const fresh = { notes: " ", exercises: [] };
  assert.equal(resolveWorkoutDraftGym(fresh, "preferred"), "preferred");
  assert.equal(resolveWorkoutDraftGym({ ...fresh, exercises: [{}] }, "preferred"), null);
  assert.equal(resolveWorkoutDraftGym({ ...fresh, notes: "Session in progress" }, "preferred"), null);
  assert.equal(resolveWorkoutDraftGym({ ...fresh, gymId: null }, "preferred"), null);
  assert.equal(resolveWorkoutDraftGym({ ...fresh, gymId: "assigned" }, "preferred"), "assigned");
});

test("an unused October draft follows the local day until an athlete picks a date or starts logging", async () => {
  const { resolveWorkoutDraftDate } = await loadSource("../packages/core/src/workout.ts");
  const october = "2026-10-16";
  const november = "2026-11-20";
  const draft = { date: october, notes: " ", exercises: [], gymId: "north", bodyWeight: "80" };
  assert.equal(resolveWorkoutDraftDate(draft, november), november);
  assert.equal(draft.date, october, "displaying an old reset does not change its synced contents");
  assert.equal(resolveWorkoutDraftDate({ ...draft, dateExplicit: true }, november), october);
  assert.equal(resolveWorkoutDraftDate({ ...draft, notes: "Warm-up on bike" }, november), october);
  assert.equal(resolveWorkoutDraftDate({ ...draft, exercises: [{}] }, november), october);
  const started = { ...draft, date: resolveWorkoutDraftDate(draft, november), exercises: [{}] };
  assert.equal(resolveWorkoutDraftDate(started, "2026-11-21"), november);
});

test("workout links accept real calendar dates and reject rollover, timestamps and partial ISO dates", async () => {
  const { isValidISODate } = await loadSource("../packages/core/src/dates.ts", { "date-fns": await import("date-fns") });
  for (const value of ["2026-11-20", "2026-10-16", "2024-02-29"]) assert.ok(isValidISODate(value), value);
  for (const value of ["2026-02-29", "2026-13-40", "2026-11", "2026-11-20T22:00:00Z", ""]) {
    assert.equal(isValidISODate(value), false, value);
  }
});

test("the local day advances at calendar midnight and catches up when the device wakes", async (t) => {
  const dates = await loadSource("../packages/core/src/dates.ts", { "date-fns": await import("date-fns") });
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: new Date(2026, 9, 24, 23, 59, 59, 500).getTime() });
  let displayed, onFocus, unmount;
  const { useLocalToday } = await loadSource("../packages/core/src/use-local-today.ts", {
    "./dates": dates,
    react: {
      useState: initial => [initial(), day => { displayed = day; }],
      useEffect: mount => { unmount = mount(); },
    },
    "@tanstack/react-query": {
      focusManager: { subscribe(listener) { onFocus = listener; return () => { onFocus = null; }; } },
    },
  });
  assert.equal(useLocalToday(), "2026-10-24");
  t.mock.timers.tick(500);
  assert.equal(displayed, "2026-10-25");
  const nextDay = new Date(2026, 9, 26).getTime();
  t.mock.timers.tick(nextDay - Date.now() - 1);
  assert.equal(displayed, "2026-10-25");
  t.mock.timers.tick(1);
  assert.equal(displayed, "2026-10-26");
  t.mock.timers.setTime(new Date(2026, 10, 20, 0, 15).getTime());
  onFocus(true);
  assert.equal(displayed, "2026-11-20");
  unmount();
  assert.equal(onFocus, null);
});

test("universal and pre-migration exercises work in current and future gyms", async () => {
  const { filterExercisesByGym } = await loadSource("../packages/core/src/gym-data.ts", { "./pagination": pagination });
  const legacy = { id: "legacy" };
  const universal = { id: "universal", is_universal: true };
  const scoped = { id: "scoped", is_universal: false };
  const catalog = [legacy, universal, scoped];
  const gyms = [{ id: "selected", exercise_ids: [scoped.id] }, { id: "future", exercise_ids: [] }];
  assert.deepEqual(filterExercisesByGym(catalog, gyms, "selected"), catalog);
  assert.deepEqual(filterExercisesByGym(catalog, gyms, "future"), [legacy, universal]);
  assert.deepEqual(filterExercisesByGym(catalog, gyms, "none"), [legacy, universal]);
  assert.deepEqual(filterExercisesByGym(catalog, gyms, ""), catalog);
});

async function loadWebDraft(todayISO) {
  const storage = await loadSource("../src/features/workout-form/model/draft-storage.ts");
  return loadSource("../src/features/workout-form/model/draft.ts", {
    zustand: await import("zustand"),
    "zustand/middleware": await import("zustand/middleware"),
    "@/shared/config/workout": await loadSource("../packages/core/src/workout.ts"),
    "@/shared/config/storage": await loadSource("../src/shared/config/storage.ts"),
    "@/shared/lib/dates": { todayISO },
    "@/shared/lib/weight": await loadSource("../packages/core/src/weight.ts"),
    "./draft-sync-engine": await loadSource("../src/features/workout-form/model/draft-sync-engine.ts"),
    "./draft-storage": storage,
  });
}

test("first set after an old reset sends today's date to the database while backdated and overnight workouts keep their date", async () => {
  let today = "2026-10-16";
  const { useNewWorkoutDraft, draftToInput } = await loadWebDraft(() => today);
  const state = useNewWorkoutDraft.getState;
  state().activateOwner("athlete");
  state().reset();
  const oldReset = JSON.parse(JSON.stringify(state().draft));
  today = "2026-11-20";
  useNewWorkoutDraft.setState({ draft: oldReset });
  const exercise = { exerciseId: "bench", notes: "", equipment: "free_weight", sets: [{ weight: "40", reps: "8" }] };
  const logSet = () => state().setDraft({ ...state().draft, exercises: [exercise] });
  const payload = () => workoutRpcInput(draftToInput(state().draft, "kg"));
  logSet();
  assert.equal(payload().date, today);
  assert.equal(payload().exercises[0].sets[0].weight_kg, 40);
  today = "2026-11-21";
  state().setDraft({ ...state().draft, notes: "Finished after midnight" });
  assert.equal(payload().date, "2026-11-20");
  state().reset();
  state().setDraft({ ...state().draft, date: "2026-10-16", dateExplicit: true });
  logSet();
  assert.equal(payload().date, "2026-10-16");
  assert.ok(!("dateExplicit" in payload()));
});

test("web drafts preserve gym choices through JSON persistence, edits, and account switches", async () => {
  const { useNewWorkoutDraft, workoutToDraft, draftToInput } = await loadWebDraft(() => "2026-01-15");
  const workout = { type: "Upper", date: "2026-01-14", workout_exercises: [] };
  const draft = workoutToDraft(workout, new Map(), "kg");
  assert.ok(!("gym_id" in draftToInput(draft, "kg")), "legacy draft uses original write path");
  const assigned = workoutToDraft({ ...workout, gym_id: "gym-a" }, new Map(), "kg");
  assert.equal(draftToInput(assigned, "kg").gym_id, "gym-a");
  const state = useNewWorkoutDraft.getState;
  state().activateOwner("owner-a");
  state().setDraft(assigned);
  assert.equal(draftToInput(JSON.parse(JSON.stringify(state().draft)), "kg").gym_id, "gym-a");
  state().activateOwner("owner-b");
  assert.ok(!("gym_id" in draftToInput(state().draft, "kg")));
  state().activateOwner("owner-a");
  assert.equal(state().draft.gymId, "gym-a");
  state().setDraft({ ...state().draft, gymId: null });
  assert.equal(draftToInput(state().draft, "kg").gym_id, null, "an explicit edit can clear a gym");
  state().reset();
  assert.ok(!("gym_id" in draftToInput(state().draft, "kg")), "a finished workout clears the next draft");
});

test("an older gym stays reachable in complete history and catalog through the paged backend client", async () => {
  const { createBackendDataClient } = await loadSource("../packages/core/src/backend-data-client.ts");
  const { fetchWorkouts, fetchWorkout } = await loadSource("../packages/core/src/workout-read.ts", { "./pagination": pagination });
  const { fetchExercises } = await loadSource("../packages/core/src/catalog-read.ts", { "./pagination": pagination });
  const owner = "owner-a";
  const headers = Array.from({ length: 1003 }, (_, i) => ({ id: `w${i}`, gym_id: i === 1002 ? "old-gym" : null }));
  const catalog = headers.map(({ id }) => ({ id: `exercise-${id}` }));
  const oldest = headers.at(-1);
  const occurrence = { id: "logged", workout_id: oldest.id, exercise_id: catalog.at(-1).id, position: 0 };
  const set = { id: "set", workout_exercise_id: occurrence.id, weight_kg: 60, reps: 6, position: 0 };
  const complete = { ...oldest, workout_exercises: [{ ...occurrence, sets: [set] }] };
  const calls = [];
  const client = createBackendDataClient(async (operation, input) => {
    calls.push(operation);
    if (operation === "workouts.detail") return { data: complete };
    const data = {
      "workouts.headers": headers,
      "workouts.exercises": input.workoutIds?.includes(oldest.id) ? [occurrence] : [],
      "workouts.sets": input.occurrenceIds?.includes(occurrence.id) ? [set] : [],
      "exercises.list": catalog,
    }[operation];
    assert.ok(data, operation);
    const offset = input.offset ?? 0;
    return { data: data.slice(offset, offset + Math.min(35, input.limit)), count: input.count ? data.length : null };
  }, () => owner);
  const signal = new AbortController().signal;
  const workouts = await fetchWorkouts(client, owner, signal);
  assert.equal(workouts.length, 1003);
  assert.deepEqual(workouts.at(-1), complete);
  assert.deepEqual(await fetchExercises(client, owner, signal), catalog);
  calls.length = 0;
  assert.deepEqual(await fetchWorkout(client, owner, oldest.id, signal), complete);
  assert.deepEqual(calls, ["workouts.detail"]);
});
