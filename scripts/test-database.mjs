/** Isolated SQL regression harness. Never uses DATABASE_URL or project env. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scratch = mkdtempSync(join(tmpdir(), "deepgym-sql-"));
const cluster = join(scratch, "data");
const socket = join(scratch, "socket");
mkdirSync(socket);
const username = userInfo().username;
// Explicit local Unix socket; ignore inherited libpq defaults and credentials.
const env = { ...process.env };
for (const key of Object.keys(env)) if (key.startsWith("PG")) delete env[key];
Object.assign(env, { PGHOST: socket, PGPORT: "55473", PGUSER: username, PGDATABASE: "postgres", PGSERVICEFILE: "/dev/null", PGPASSFILE: "/dev/null" });
function command(name, args, input) {
  return execFileSync(name, args, { env, input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}
function sql(input) {
  return command("psql", ["-X", "-h", socket, "-p", "55473", "-U", username, "-d", "postgres", "-v", "ON_ERROR_STOP=1"], input);
}
let running = false;
try {
  command("initdb", ["-D", cluster, "--auth=trust", "--encoding=UTF8", "--no-locale"]);
  command("pg_ctl", ["-D", cluster, "-l", join(scratch, "postgres.log"), "-o", `-h '' -k '${socket}' -p 55473 -F`, "-w", "start"]);
  running = true;
  sql(`
    create role authenticated nologin;
    create role anon nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    create function auth.role() returns text language sql stable as
      'select current_setting(''request.jwt.claim.role'', true)';
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as
      'select string_to_array($1, ''/'')';
    grant usage on schema public, auth, storage to authenticated, anon, service_role;
    grant execute on all functions in schema auth to authenticated, anon, service_role;
    alter default privileges in schema public grant all on tables to authenticated, service_role;
    alter default privileges in schema public grant all on sequences to authenticated, service_role;
    -- Hosted Supabase defaults include explicit anon EXECUTE grants; a PUBLIC
    -- revoke alone must not make these permission regressions falsely pass.
    alter default privileges in schema public grant execute on functions to anon;
  `);
  const migrations = readdirSync(join(root, "supabase/migrations")).filter(name => name.endsWith(".sql")).sort();
  for (const name of migrations) {
    sql(readFileSync(join(root, "supabase/migrations", name), "utf8"));
    console.log(`PASS migration ${name}`);
  }
  const releaseBundle = readFileSync(join(root, "supabase/deploy/2026-11-11_current_runtime_fixes.sql"), "utf8");
  sql(releaseBundle);
  sql(releaseBundle);
  console.log("PASS current Supabase deployment bundle (repeat apply, hosted default grants)");
  const regressions = readdirSync(join(root, "scripts")).filter(name => name.endsWith("database-regressions.sql") || name === "database-analytics-regressions.sql").sort();
  for (const name of regressions) {
    sql(readFileSync(join(root, "scripts", name), "utf8"));
    console.log(`PASS ${name}`);
  }
  const { runDataRepositoryRegressions } = await import("./data-repository-regressions.mjs");
  await runDataRepositoryRegressions({ host: socket, port: 55473, user: username, database: "postgres" });
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  if (running) {
    try { command("pg_ctl", ["-D", cluster, "-m", "immediate", "-w", "stop"]); }
    catch { console.error("Could not stop temporary PostgreSQL; data retained:", scratch); running = false; }
  }
  // Only this script's freshly generated test directory is eligible for removal.
  if (running || !readdirSync(scratch).includes("data")) rmSync(scratch, { recursive: true, force: true });
}
