"use client";

import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui";
import styles from "./tiles.module.scss";

type TileVariant = "surface" | "pink" | "indigo" | "cherry";

interface TileProps {
  href?: string;
  onClick?: () => void;
  variant?: TileVariant;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

/** Card chrome shared by every home tile; optionally the whole tile is a
 *  link or a button (only for tiles without inner controls). */
export function Tile({
  href,
  onClick,
  variant = "surface",
  className,
  ariaLabel,
  children,
}: TileProps) {
  const card = (
    <Card
      variant={variant}
      className={cn(
        styles.tile,
        variant === "surface" && "stat-well",
        className,
      )}
    >
      {children}
    </Card>
  );
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={styles.hit}>
        {card}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={styles.hit}
      >
        {card}
      </button>
    );
  }
  return card;
}

type BadgeTone = "lime" | "white" | "indigo" | "flame" | "pink";

export function TileHead({
  label,
  icon,
  tone = "white",
  onGradient = false,
  action,
}: {
  label: string;
  icon?: React.ReactNode;
  tone?: BadgeTone;
  onGradient?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.head}>
      <p className={cn(styles.label, onGradient && styles.labelOnGradient)}>
        {label}
      </p>
      {action}
      {icon && (
        <span className={cn(styles.badge, styles[`badge_${tone}`])}>
          {icon}
        </span>
      )}
    </div>
  );
}
