import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Exercise the actual TypeScript source without requiring a test framework or
// depending on the Node release's TypeScript stripping support.
const source = await readFile(new URL("../src/shared/lib/server-origin.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getServerRedirectBase, safeLocalRedirectPath } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("container redirects use the explicit public origin and preserve path/query", () => {
  const base = getServerRedirectBase(
    "https://0.0.0.0:3000/about/uk?campaign=one",
    "https://www.deepgym.fit",
  );
  assert.equal(base.href, "https://www.deepgym.fit/about/uk?campaign=one");
  base.pathname = "/uk";
  assert.equal(base.href, "https://www.deepgym.fit/uk?campaign=one");
  assert.equal(new URL("/login?error=oauth", base).href, "https://www.deepgym.fit/login?error=oauth");
});

test("an unset override preserves preview and development request origins", () => {
  for (const origin of ["http://localhost:3000", "https://deepgym-preview.vercel.app"]) {
    assert.equal(getServerRedirectBase(`${origin}/history?x=1`, "").href, `${origin}/history?x=1`);
  }
});

test("explicit HTTP origin and port work for local deployment checks", () => {
  assert.equal(
    getServerRedirectBase("http://0.0.0.0:3000/history", "http://localhost:8080/").href,
    "http://localhost:8080/history",
  );
});

test("invalid deployment origins fail rather than producing unsafe redirects", () => {
  for (const origin of [
    "not-a-url", "//example.com", "javascript:alert(1)", "ftp://example.com",
    "https://user:pass@example.com", "https://example.com/path",
    "https://example.com/?x=1", "https://example.com/#fragment", "https://example.com/?",
    "https://example.com/#", " https://example.com", "https://example.com\\evil",
  ]) {
    assert.throws(() => getServerRedirectBase("https://request.example/history", origin), /APP_ORIGIN/);
  }
});

test("a double-slash request path cannot override the configured destination host", () => {
  const base = getServerRedirectBase("http://0.0.0.0:3000//attacker.example/a", "https://www.deepgym.fit");
  assert.equal(base.origin, "https://www.deepgym.fit");
  assert.equal(base.pathname, "//attacker.example/a");
});

test("OAuth next accepts local paths with query/fragment and rejects authority tricks", () => {
  const publicOrigin = "https://www.deepgym.fit";
  const allowed = ["/", "/history?date=2026-11-10", "/settings?open=profile#avatar"];
  for (const path of allowed) {
    assert.equal(safeLocalRedirectPath(path), path);
    assert.equal(new URL(safeLocalRedirectPath(path), publicOrigin).origin, publicOrigin);
  }
  for (const path of [
    null, "", "https://attacker.example", "//attacker.example", "///attacker.example",
    "@attacker.example", "/\\attacker.example", "\\attacker.example", "/path\\next",
    "/\n/attacker.example", "/\t/attacker.example", "/\r/attacker.example", "/\u0000bad",
  ]) {
    assert.equal(safeLocalRedirectPath(path), "/");
    assert.equal(new URL(safeLocalRedirectPath(path), publicOrigin).origin, publicOrigin);
  }
});
