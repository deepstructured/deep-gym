import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
import styles from "./card.module.scss";

type CardVariant = "surface" | "pink" | "indigo" | "cherry" | "flame";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

/* Gradient fills live in globals.css (grad-* / glow-*) — they are shared
   decorative surfaces, not per-component styles. */
const variants: Record<CardVariant, string> = {
  surface: "surface-well",
  pink: "grad-pink glow-pink",
  indigo: "grad-indigo glow-indigo",
  cherry: "grad-cherry glow-cherry",
  flame: "grad-flame glow-flame",
};

export function Card({ variant = "surface", className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        styles.card,
        variants[variant],
        variant !== "surface" && styles.onGradient,
        className,
      )}
      {...props}
    />
  );
}
