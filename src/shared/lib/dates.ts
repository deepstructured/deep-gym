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

export function formatDay(iso: string): string {
  return format(parseISO(iso), "EEE, MMM d");
}

export function formatDayFull(iso: string): string {
  return format(parseISO(iso), "EEEE, MMMM d");
}

export function formatShort(iso: string): string {
  return format(parseISO(iso), "MMM d");
}
