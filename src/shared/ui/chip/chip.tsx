"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
import styles from "./chip.module.scss";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        styles.chip,
        selected ? styles.selected : styles.idle,
        className,
      )}
      {...props}
    />
  );
}
