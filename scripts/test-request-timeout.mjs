import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/shared/lib/request-timeout.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { withTimeout, createFetchWithTimeout } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("whole-operation deadline interrupts an SDK promise that never settles", async () => {
  let signal;
  await assert.rejects(withTimeout((value) => {
    signal = value;
    return new Promise(() => {});
  }, 20), { name: "TimeoutError" });
  assert.equal(signal.aborted, true);
});

test("an already cancelled operation never starts", async () => {
  const parent = new AbortController();
  parent.abort();
  let called = false;
  await assert.rejects(withTimeout(async () => { called = true; }, 50, parent.signal), { name: "AbortError" });
  assert.equal(called, false);
});

test("parent cancellation interrupts the operation", async () => {
  const parent = new AbortController();
  const operation = withTimeout(() => new Promise(() => {}), 1000, parent.signal);
  parent.abort();
  await assert.rejects(operation, { name: "AbortError" });
});

test("successful completion removes the operation timer", async () => {
  let signal;
  assert.equal(await withTimeout(async value => { signal = value; return 42; }, 10), 42);
  await delay(20);
  assert.equal(signal.aborted, false);
});

test("fetch cancellation remains active after headers, during body consumption", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => new Response(new ReadableStream({
    start(controller) {
      init.signal.addEventListener("abort", () => controller.error(init.signal.reason), { once: true });
    },
  }));
  // Keep the event loop alive: AbortSignal.timeout uses an unref'ed timer in Node.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const response = await createFetchWithTimeout(20)("https://unused.example");
    await assert.rejects(response.text(), { name: "TimeoutError" });
  } finally {
    globalThis.fetch = originalFetch;
    clearInterval(keepAlive);
  }
});

test("fetch preserves a caller's explicit cancellation signal", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_input, init) => new Promise((_, reject) => {
    if (init.signal.aborted) reject(init.signal.reason);
    else init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  });
  try {
    const parent = new AbortController();
    const request = createFetchWithTimeout(1000)("https://unused.example", { signal: parent.signal });
    parent.abort();
    await assert.rejects(request, { name: "AbortError" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
