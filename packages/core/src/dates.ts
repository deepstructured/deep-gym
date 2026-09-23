import { format, parseISO } from "date-fns";

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
