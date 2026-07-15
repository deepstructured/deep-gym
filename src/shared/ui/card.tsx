import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

type CardVariant = "surface" | "pink" | "indigo" | "cherry" | "flame";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variants: Record<CardVariant, string> = {
  surface: "surface-well",
  pink: "grad-pink glow-pink text-white",
  indigo: "grad-indigo glow-indigo text-white",
  cherry: "grad-cherry glow-cherry text-white",
  flame: "grad-flame glow-flame text-white",
};

export function Card({ variant = "surface", className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card p-5",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
