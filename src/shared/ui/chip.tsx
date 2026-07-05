"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors select-none",
        selected
          ? "bg-lime text-black"
          : "border border-line bg-raised text-muted active:text-text",
        className,
      )}
      {...props}
    />
  );
}
