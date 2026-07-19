"use client";

import { cn } from "@/shared/lib/cn";
import styles from "./toggle.module.scss";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  tone?: "lime" | "cherry" | "indigo";
}

const checkedTones = {
  lime: styles.checkedLime,
  cherry: styles.checkedCherry,
  indigo: styles.checkedIndigo,
} as const;

export function Toggle({
  checked,
  onChange,
  label,
  className,
  tone = "lime",
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(styles.toggle, checked && checkedTones[tone], className)}
    >
      <span className={cn(styles.knob, checked && styles.knobChecked)} />
    </button>
  );
}
