import { cn } from "@/shared/lib/cn";
import styles from "./dot-value.module.scss";

/** A number in the dot-matrix display font, with an optional unit suffix. */
export function DotValue({
  value,
  suffix,
  className,
  suffixClassName,
}: {
  value: string | number;
  suffix?: string;
  className?: string;
  suffixClassName?: string;
}) {
  return (
    <span className={cn(styles.dotValue, className)}>
      {value}
      {suffix && (
        <span className={cn(styles.dotSuffix, suffixClassName)}>{suffix}</span>
      )}
    </span>
  );
}
