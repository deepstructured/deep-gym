import { DataRequestError } from "./validation";

/** Do not return raw PostgreSQL messages, SQL, relation names, connection
 * strings or constraint details to clients. Preserve only known domain codes. */
export function dataError(error: unknown): { status: number; error: { code: string; message: string } } {
  if (error instanceof DataRequestError) return { status: error.status, error: { code: error.code, message: error.message } };
  const value = error && typeof error === "object" ? error as { code?: unknown; message?: unknown; name?: unknown } : {};
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message : "";
  if (message === "WORKOUT_LOAD_MODE_MISMATCH") return { status: 409, error: { code: "23514", message } };
  if (message === "WORKOUT_CREATE_KEY_CONFLICT") return { status: 409, error: { code: "23505", message } };
  if (code === "42501") return { status: 403, error: { code, message: "This operation is not permitted" } };
  if (code === "P0002") return { status: 404, error: { code, message: "Record not found" } };
  if (code === "23503") return { status: 409, error: { code, message: "This record is still in use" } };
  if (code === "23505") return { status: 409, error: { code, message: "This record already exists" } };
  if (code.startsWith("22") || code === "23514" || code === "23502") return { status: 400, error: { code, message: "Invalid data" } };
  if (code === "42883") return { status: 503, error: { code, message: "This operation is temporarily unavailable" } };
  return { status: 503, error: { code: "SERVICE_UNAVAILABLE", message: "The service is temporarily unavailable. Please retry." } };
}
