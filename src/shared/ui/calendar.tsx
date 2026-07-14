"use client";

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useState } from "react";
import { formatMonthYear, getDateLocale, toISODate } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { IconChevronLeft, IconChevronRight } from "./icons";

interface CalendarProps {
  /** Selected day as ISO date (yyyy-MM-dd), or null. */
  value: string | null;
  onChange: (iso: string) => void;
  /** Days to flag with a dot (e.g. days that have data). */
  markedDates?: Set<string>;
  /** Latest selectable day (ISO). Days after are disabled. */
  maxDate?: string;
  /** Earliest selectable day (ISO). Days before are disabled. */
  minDate?: string;
  className?: string;
}

/** Month-grid date picker. Week starts Monday. */
export function Calendar({
  value,
  onChange,
  markedDates,
  maxDate,
  minDate,
  className,
}: CalendarProps) {
  const selected = value ? parseISO(value) : null;
  const [month, setMonth] = useState(() =>
    startOfMonth(selected ?? new Date()),
  );

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({
    start: gridStart,
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  const weekdays = eachDayOfInterval({
    start: gridStart,
    end: addDays(gridStart, 6),
  }).map((day) => format(day, "EEEEEE", { locale: getDateLocale() }));

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-muted active:text-text"
        >
          <IconChevronLeft size={16} />
        </button>
        <span className="font-semibold">{formatMonthYear(month)}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-muted active:text-text"
        >
          <IconChevronRight size={16} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium tracking-wide text-faint uppercase">
        {weekdays.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = toISODate(day);
          const inMonth = isSameMonth(day, month);
          const isSelected = selected != null && isSameDay(day, selected);
          const marked = markedDates?.has(iso) ?? false;
          const disabled =
            (maxDate != null && iso > maxDate) ||
            (minDate != null && iso < minDate);

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(iso)}
              className={cn(
                "relative flex h-10 items-center justify-center rounded-tile font-dot text-sm transition-colors",
                isSelected
                  ? "bg-lime text-black"
                  : inMonth
                    ? "text-text active:bg-raised"
                    : "text-faint/60",
                !isSelected && isToday(day) && "ring-1 ring-line",
                disabled && "pointer-events-none opacity-30",
              )}
            >
              {format(day, "d")}
              {marked && (
                <span
                  className={cn(
                    "absolute bottom-1.5 h-1 w-1 rounded-full",
                    isSelected ? "bg-black/60" : "bg-lime",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
