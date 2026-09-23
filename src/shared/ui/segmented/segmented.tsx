"use client";

import { cn } from "@/shared/lib/cn";
import styles from "./segmented.module.scss";

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: SegmentedProps<T>) {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(styles.group, className)}
    >
      <span
        className={styles.thumb}
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
        aria-hidden="true"
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            styles.option,
            option.value === value && styles.active,
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
