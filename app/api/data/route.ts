import { NextResponse } from "next/server";
import { assertAuthCsrf, getAuthenticatedUser } from "@/server/auth";
import { withAuthenticatedDb } from "@/server/db";
import { isDataMutation } from "@/server/data/contracts";
import { executeDataOperation } from "@/server/data/repository";
import { dataError } from "@/server/data/errors";
import { DataRequestError, request as validateRequest } from "@/server/data/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 2 * 1024 * 1024;
const HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };

async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new DataRequestError("JSON content type is required", "UNSUPPORTED_MEDIA_TYPE", 415);
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new DataRequestError("Request is too large", "PAYLOAD_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DataRequestError("Request body is required");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new DataRequestError("Request is too large", "PAYLOAD_TOO_LARGE", 413);
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new DataRequestError("Invalid JSON body"); }
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_BACKEND !== "postgres") {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: HEADERS });
  }
  const requestId = crypto.randomUUID();
  let operation = "unknown";
  try {
    try { assertAuthCsrf(request); }
    catch (error) {
      if (error instanceof Error && ["CROSS_ORIGIN_AUTH_REQUEST", "AUTH_ORIGIN_REQUIRED"].includes(error.message)) {
        throw new DataRequestError("Request origin is not permitted", "FORBIDDEN", 403);
      }
      if (error instanceof Error && error.message === "AUTH_JSON_REQUIRED") {
        throw new DataRequestError("JSON content type is required", "UNSUPPORTED_MEDIA_TYPE", 415);
      }
      throw error;
    }
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ data: null, error: { code: "UNAUTHENTICATED", message: "Sign in to continue" } }, { status: 401, headers: HEADERS });
    const body = validateRequest(await readBody(request));
    operation = body.operation;
    const result = await withAuthenticatedDb(user.id,
      (db) => executeDataOperation(db, user.id, body.operation, body.input),
      { readOnly: !isDataMutation(body.operation), signal: request.signal });
    return NextResponse.json({ ...result, error: null }, { headers: HEADERS });
  } catch (error) {
    const result = dataError(error);
    if (result.status >= 500) console.error("[data-api] operation failed", { requestId, operation, code: result.error.code });
    return NextResponse.json({ data: null, error: result.error, requestId }, { status: result.status, headers: HEADERS });
  }
}
