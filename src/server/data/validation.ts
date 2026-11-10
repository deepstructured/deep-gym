import { DATA_OPERATIONS, type DataRequest } from "./contracts";

export class DataRequestError extends Error {
  constructor(message: string, readonly code = "INVALID_INPUT", readonly status = 400) { super(message); }
}
export function object(value: unknown, label = "input"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DataRequestError(`Invalid ${label}`);
  return value as Record<string, unknown>;
}
export function fields(input: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(input).some((key) => !allowed.includes(key))) throw new DataRequestError("Unsupported input field");
}
export function request(value: unknown): DataRequest {
  const body = object(value, "request");
  fields(body, ["operation", "input"]);
  if (typeof body.operation !== "string" || !(DATA_OPERATIONS as readonly string[]).includes(body.operation)) {
    throw new DataRequestError("Unsupported operation");
  }
  return { operation: body.operation as DataRequest["operation"], input: body.input == null ? {} : object(body.input) };
}
export function text(value: unknown, label: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new DataRequestError(`Invalid ${label}`);
  return value.trim();
}
export function nullableText(value: unknown, label: string, max = 5000): string | null {
  if (value == null || value === "") return null;
  return text(value, label, max);
}
export function uuid(value: unknown, label = "id"): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new DataRequestError(`Invalid ${label}`);
  return value;
}
export function uuids(value: unknown, label = "ids", max = 200): string[] {
  if (!Array.isArray(value) || value.length > max) throw new DataRequestError(`Invalid ${label}`);
  return [...new Set(value.map((item) => uuid(item, label)))];
}
export function date(value: unknown, label = "date"): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DataRequestError(`Invalid ${label}`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new DataRequestError(`Invalid ${label}`);
  return value;
}
export function timestamp(value: unknown, label = "timestamp"): string {
  if (typeof value !== "string" || value.length > 50 || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw new DataRequestError(`Invalid ${label}`);
  return new Date(value).toISOString();
}
export function number(value: unknown, label: string, min = 0, max = 1000000): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new DataRequestError(`Invalid ${label}`);
  return value;
}
export function integer(value: unknown, label: string, min = 0, max = 2147483647): number {
  const result = number(value, label, min, max);
  if (!Number.isInteger(result)) throw new DataRequestError(`Invalid ${label}`);
  return result;
}
export function choice<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new DataRequestError(`Invalid ${label}`);
  return value as T;
}
export function page(input: Record<string, unknown>) {
  return {
    offset: input.offset == null ? 0 : integer(input.offset, "offset", 0, 10000000),
    limit: input.limit == null ? null : integer(input.limit, "limit", 1, 10000),
    count: input.count === true,
  };
}
