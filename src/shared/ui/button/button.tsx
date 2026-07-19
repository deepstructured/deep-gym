"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
import { Spinner } from "../spinner/spinner";
import styles from "./button.module.scss";

type Variant = "lime" | "gradient" | "surface" | "ghost" | "danger";
type Size = "sm" | "compact" | "md" | "lg";
type Tone = "lime" | "faint";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Stretch to the container's full width. */
  block?: boolean;
  /** Grow to fill a flex row (flex: 1). */
  grow?: boolean;
  /** Square button holding only an icon — no horizontal padding. */
  iconOnly?: boolean;
  /** Text-color accent, mainly for ghost buttons. */
  tone?: Tone;
  /** Dashed border (surface variant). */
  dashed?: boolean;
}

export function Button({
  variant = "surface",
  size = "md",
  loading,
  block,
  grow,
  iconOnly,
  tone,
  dashed,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        variant === "gradient" && "grad-pink glow-pink",
        block && styles.block,
        grow && styles.grow,
        iconOnly && styles.iconOnly,
        tone === "lime" && styles.toneLime,
        tone === "faint" && styles.toneFaint,
        dashed && styles.dashed,
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}
