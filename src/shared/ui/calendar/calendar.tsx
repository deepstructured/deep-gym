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
import { IconChevronLeft, IconChevronRight } from "../icons/icons";
import styles from "./calendar.module.scss";

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
    <div className={cn(styles.calendar, className)}>
      <div className={styles.header}>
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className={styles.navButton}
        >
          <IconChevronLeft size={16} />
        </button>
        <span className={styles.month}>{formatMonthYear(month)}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className={styles.navButton}
        >
          <IconChevronRight size={16} />
        </button>
      </div>

      <div className={styles.weekdays}>
        {weekdays.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>

      <div className={styles.grid}>
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
                styles.day,
                !inMonth && styles.outside,
                isToday(day) && !isSelected && styles.today,
                isSelected && styles.selected,
                disabled && styles.disabled,
              )}
            >
              {format(day, "d")}
              {marked && (
                <span
                  className={cn(styles.dot, isSelected && styles.dotSelected)}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
