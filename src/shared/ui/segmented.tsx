"use client";

import { cn } from "@/shared/lib/cn";

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      className={cn(
        "flex rounded-full border border-line bg-surface p-1",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "h-9 flex-1 rounded-full text-sm font-medium transition-colors",
            option.value === value
              ? "bg-lime text-black"
              : "text-muted active:text-text",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
