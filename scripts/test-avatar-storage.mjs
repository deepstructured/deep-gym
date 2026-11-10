import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import ts from "typescript";

async function compiled(file, imports) {
  const source = await fs.readFile(new URL(file, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("exports", "require", output)(exports, name => {
    if (!(name in imports)) throw new Error(`Unexpected dependency ${name}`);
    return imports[name];
  });
  return exports;
}
const avatars = await compiled("../src/server/avatars.ts", { "server-only": {}, "node:fs/promises": fs, "node:path": path });
const owner = "11111111-1111-1111-1111-111111111111", other = "22222222-2222-2222-2222-222222222222";
const route = await compiled("../app/api/storage/avatars/[owner]/[filename]/route.ts", {
  "@/server/auth": { getAuthenticatedUser: async req => req.headers.get("authorization") === "Bearer fixture" ? { id: owner } : null },
  "@/server/avatars": avatars,
});
test("avatar HTTP storage enforces ownership, paths, size, origin and immutable byte roundtrip", async () => {
  const folder = await fs.mkdtemp(path.join(tmpdir(), "deepgym-avatars-"));
  const previous = { backend: process.env.NEXT_PUBLIC_BACKEND, root: process.env.AVATAR_STORAGE_DIR, origin: process.env.APP_ORIGIN };
  Object.assign(process.env, { NEXT_PUBLIC_BACKEND: "postgres", AVATAR_STORAGE_DIR: folder, APP_ORIGIN: "https://fixture.invalid" });
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64");
  const context = (id = owner, filename = "avatar-test.png") => ({ params: Promise.resolve({ owner: id, filename }) });
  const request = (extra = {}, body = bytes) => new Request("https://fixture.invalid/api/storage/avatars/test", { method: "POST", headers: { authorization: "Bearer fixture", "content-type": "image/png", ...extra }, body });
  try {
    assert.equal((await route.POST(request(), context(other))).status, 403);
    assert.equal((await route.POST(request(), context(owner, "../secret.png"))).status, 400);
    assert.equal((await route.POST(request({ authorization: "" }), context())).status, 401);
    assert.equal((await route.POST(request({ origin: "https://evil.invalid" }), context())).status, 403);
    assert.equal((await route.POST(request({ authorization: "", cookie: "dg_refresh=fixture" }), context())).status, 403);
    assert.equal((await route.POST(request({ "content-length": String(avatars.MAX_AVATAR_BYTES + 1) }), context())).status, 413);
    assert.equal((await route.POST(request({}, Buffer.from("<svg onload=alert(1)>")), context())).status, 400);
    assert.equal((await route.POST(request(), context())).status, 200);
    assert.equal((await route.POST(request(), context())).status, 409);
    const loaded = await route.GET(request(), context());
    assert.equal(loaded.status, 200);
    assert.equal(loaded.headers.get("content-type"), "image/png");
    assert.equal(loaded.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(Buffer.from(await loaded.arrayBuffer()), bytes);
    assert.equal((await route.DELETE(request(), context(other))).status, 403);
    await avatars.removeAccountAvatars(owner);
    assert.equal((await route.GET(request(), context())).status, 404);
    assert.throws(() => avatars.avatarDirectory("../"));
  } finally {
    for (const [name, value] of [["NEXT_PUBLIC_BACKEND", previous.backend], ["AVATAR_STORAGE_DIR", previous.root], ["APP_ORIGIN", previous.origin]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    await fs.rm(folder, { recursive: true, force: true });
  }
});
