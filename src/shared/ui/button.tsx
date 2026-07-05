"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
import { Spinner } from "./spinner";

type Variant = "lime" | "gradient" | "surface" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  lime: "bg-lime text-black font-semibold active:brightness-90",
  gradient:
    "grad-pink glow-pink text-white font-semibold active:brightness-95",
  surface:
    "bg-raised text-text border border-line active:bg-line/60 font-medium",
  ghost: "bg-transparent text-muted active:text-text font-medium",
  danger: "bg-flame/15 text-[#ff7a5c] border border-flame/30 font-medium",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm gap-1.5",
  md: "h-12 px-5 text-[15px] gap-2",
  lg: "h-14 px-7 text-base gap-2",
};

export function Button({
  variant = "surface",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-[filter,background-color,opacity] select-none",
        variants[variant],
        sizes[size],
        (disabled || loading) && "opacity-50 pointer-events-none",
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
