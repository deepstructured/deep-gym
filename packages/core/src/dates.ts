import { format, isValid, parseISO } from "date-fns";

/** ISO date (yyyy-MM-dd) for a local Date. */
export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function fromISODate(iso: string): Date {
  return parseISO(iso);
}

export function isValidISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
}
