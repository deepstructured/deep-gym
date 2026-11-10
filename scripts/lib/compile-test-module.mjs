import { readFile } from "node:fs/promises";
import ts from "typescript";

/** Run the real TypeScript module with explicit dependencies, without a build. */
export async function compileTestModule(file, imports = {}) {
  const source = await readFile(file, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("exports", "require", output)(exports, name => {
    if (!(name in imports)) throw new Error(`Unexpected dependency ${name}`);
    return imports[name];
  });
  return exports;
}
