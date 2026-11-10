import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveIssues, publicationIssues } from "./check-publication.mjs";

test("known literals report locations/categories without values",()=>{
  const value="synthetic-sensitive-value";
  const result=publicationIssues("src/example.ts",Buffer.from(`// harmless\nconst leaked='${value}';\n`),[{value,category:"fixture credential"}]);
  assert.deepEqual(result,[{path:"src/example.ts",line:2,category:"fixture credential"}]);
  assert.ok(!JSON.stringify(result).includes(value));
});
test("private artifacts are blocked while documented examples remain publishable",()=>{
  for(const file of [".env.local",".local-secrets/example.key","artifacts/releases/receipt.json","export.dump",".vercel/project.json"])
    assert.ok(publicationIssues(file,Buffer.from("fixture")).length);
  assert.deepEqual(publicationIssues(".env.example",Buffer.from("SECRET=replace-me")),[]);
  assert.deepEqual(publicationIssues("apps/mobile/.env.example",Buffer.from("URL=")),[]);
});
test("binary backup keys cannot bypass the scan",()=>{
  const key=Buffer.alloc(32,7);
  const result=publicationIssues("image.bin",Buffer.concat([Buffer.from([0]),key]),[{value:key,category:"fixture key"}]);
  assert.equal(result[0].category,"fixture key");
});
test("private keys and deployment IDs require review, generic runtime code does not",()=>{
  const marker=["-----BEGIN ","PRIVATE KEY-----"].join("");
  assert.equal(publicationIssues("note.txt",Buffer.from(marker))[0].category,"private-key material");
  const deployment=["dpl_","a".repeat(24)].join("");
  assert.equal(publicationIssues("note.md",Buffer.from(deployment))[0].category,"live deployment identifier");
  assert.deepEqual(publicationIssues("src/config.ts",Buffer.from("const secret = process.env.SESSION_SIGNING_SECRET;")),[]);
});

test("generic credential shapes are detected without printing fixture tokens",()=>{
  const fixtures = [
    [["ghp", "_", "a".repeat(36)].join(""), "credential-shaped GitHub token"],
    [["github_pat", "_", "a".repeat(60)].join(""), "credential-shaped GitHub fine-grained token"],
    [["123456789", ":", "a".repeat(35)].join(""), "credential-shaped Telegram bot token"],
    [["sb_secret", "_", "a".repeat(24)].join(""), "credential-shaped Supabase secret key"],
  ];
  for (const [value, category] of fixtures) {
    const findings = publicationIssues("config.txt", Buffer.from(value));
    assert.equal(findings[0]?.category, category);
    assert.ok(!JSON.stringify(findings).includes(value));
  }
});

function zipFixture(entries) {
  const program = [
    "import base64, io, json, sys, zipfile",
    "output=io.BytesIO()",
    "with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:",
    " for name, content in json.load(sys.stdin):",
    "  archive.writestr(name,base64.b64decode(content))",
    "sys.stdout.buffer.write(output.getvalue())",
  ].join("\n");
  return execFileSync("python3", ["-c", program], {
    input: JSON.stringify(entries.map(([name, content]) => [name, Buffer.from(content).toString("base64")])),
    stdio: ["pipe", "pipe", "pipe"],
  });
}

test("ZIP inspection checks expanded names and bytes with correct lines, without extraction",()=>{
  const scratch = mkdtempSync(join(tmpdir(), "deepgym-publication-zip-"));
  const destination = join(scratch, "must-not-be-extracted.txt");
  const value = "synthetic-zip-sensitive-value";
  const marker = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  try {
    const archive = zipFixture([
      [".env.local", Buffer.from("first line\n" + value)],
      ["binary.bin", Buffer.concat([Buffer.from([0, 10]), Buffer.from(marker + " " + value)])],
      [destination, Buffer.from("in-memory inspection only")],
    ]);
    const findings = archiveIssues("fixture.zip", archive, [{ value, category: "fixture credential" }]);
    assert.ok(findings.some(item => item.path === "fixture.zip::.env.local" && item.line === 1 && item.category === "private artifact inside ZIP"));
    assert.ok(findings.some(item => item.path === "fixture.zip::.env.local" && item.line === 2 && item.category === "fixture credential"));
    assert.ok(findings.some(item => item.path === "fixture.zip::binary.bin" && item.line === 2 && item.category === "fixture credential"));
    assert.ok(!findings.some(item => item.path === "fixture.zip::binary.bin" && item.category === "private-key material"));
    assert.ok(!JSON.stringify(findings).includes(value));
    assert.equal(existsSync(destination), false);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("corrupt ZIP contents fail closed",()=>{
  assert.deepEqual(archiveIssues("broken.zip", Buffer.from("invalid archive")), [
    { path: "broken.zip", line: 1, category: "ZIP content could not be fully inspected" },
  ]);
});
