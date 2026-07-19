import { cn } from "@/shared/lib/cn";
import styles from "./tag.module.scss";

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "lime" | "pink" | "onGradient";
  className?: string;
}) {
  const tones = {
    neutral: styles.neutral,
    lime: styles.lime,
    pink: styles.pink,
    onGradient: styles.onGradient,
  } as const;
  return (
    <span className={cn(styles.tag, tones[tone], className)}>{children}</span>
  );
}
