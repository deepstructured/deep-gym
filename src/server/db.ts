import "server-only";
import { Pool, type PoolClient } from "pg";

export type DatabaseClient = Pick<PoolClient, "query">;
const runtime = globalThis as typeof globalThis & { deepgymDataPool?: Pool };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_SAFETY_QUERY = `select r.rolsuper or r.rolbypassrls or exists (
  select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where c.relowner=r.oid and n.nspname in ('public','auth') and c.relkind in ('r','p')
) as unsafe from pg_catalog.pg_roles r where r.rolname=current_user`;

async function assertSafeRole(client: DatabaseClient) {
  const { rows } = await client.query<{ unsafe: boolean }>(ROLE_SAFETY_QUERY);
  if (rows.length !== 1 || rows[0].unsafe) throw new Error("UNSAFE_DATABASE_ROLE");
}

function dataPool(): Pool {
  if (!runtime.deepgymDataPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
    const configuredMax = Number(process.env.DATABASE_POOL_MAX ?? 10);
    runtime.deepgymDataPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number.isInteger(configuredMax) && configuredMax > 0 && configuredMax <= 50 ? configuredMax : 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 10_000,
      query_timeout: 12_000,
      idle_in_transaction_session_timeout: 15_000,
      allowExitOnIdle: true,
      application_name: "deepgym-data-api",
    });
    runtime.deepgymDataPool.on("error", () => console.error("[data-api] idle database connection failed"));
  }
  return runtime.deepgymDataPool;
}

/** userId must come from the verified server session, never a request body.
 * One checked-out connection owns the transaction and transaction-local RLS
 * claims. Pool reuse cannot retain another user's identity. */
export async function withAuthenticatedDb<T>(
  userId: string,
  work: (db: DatabaseClient) => Promise<T>,
  options: { readOnly?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  return runUserTransaction(dataPool(), userId, work, options);
}

/** Explicit pool injection lets the isolated regression harness exercise the
 * real role/transaction boundary without reading production configuration. */
export async function runUserTransaction<T>(
  pool: Pick<Pool, "connect">,
  userId: string,
  work: (db: DatabaseClient) => Promise<T>,
  options: { readOnly?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  if (!UUID.test(userId)) throw new Error("INVALID_AUTH_IDENTITY");
  options.signal?.throwIfAborted();
  const client = await pool.connect();
  let released = false;
  let discard = false;
  const abort = () => {
    if (!released) {
      released = true;
      client.release(true); // destroys the active connection; PostgreSQL rolls back
    }
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    options.signal?.throwIfAborted();
    // Refuse an accidentally supplied superuser, bypass role, or table owner.
    await assertSafeRole(client);
    await client.query(options.readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
    await client.query("SET LOCAL ROLE app_user");
    await assertSafeRole(client);
    await client.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [userId]);
    const result = await work(client);
    options.signal?.throwIfAborted();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (!released) {
      try { await client.query("ROLLBACK"); }
      catch { discard = true; }
    }
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    if (!released) client.release(discard);
  }
}
