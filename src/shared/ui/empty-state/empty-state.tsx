import { cn } from "@/shared/lib/cn";
import styles from "./empty-state.module.scss";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <div className={cn(styles.glyph, "dots-bg")} />
      <p className={styles.title}>{title}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
