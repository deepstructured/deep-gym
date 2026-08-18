"use client";

import { useI18n } from "@/shared/i18n";
import { IconDumbbell, IconHistory, Sheet } from "@/shared/ui";
import type { WorkoutCopyMode } from "../model/draft";
import styles from "./copy-mode-sheet.module.scss";

interface CopyModeSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: WorkoutCopyMode) => void;
}

/** Shared final step for Copy Last and calendar-copy flows. */
export function CopyModeSheet({
  open,
  onClose,
  onSelect,
}: CopyModeSheetProps) {
  const { t } = useI18n();

  return (
    <Sheet open={open} onClose={onClose} title={t("workout.copyModeTitle")}>
      <div className={styles.options}>
        <button
          type="button"
          className={styles.option}
          onClick={() => onSelect("full")}
        >
          <span className={styles.icon}>
            <IconHistory size={18} />
          </span>
          <span className={styles.text}>
            <strong className={styles.title}>{t("workout.copyModeFull")}</strong>
            <span className={styles.hint}>{t("workout.copyModeFullHint")}</span>
          </span>
        </button>

        <button
          type="button"
          className={styles.option}
          onClick={() => onSelect("last-weight")}
        >
          <span className={styles.icon}>
            <IconDumbbell size={18} />
          </span>
          <span className={styles.text}>
            <strong className={styles.title}>
              {t("workout.copyModeWeight")}
            </strong>
            <span className={styles.hint}>{t("workout.copyModeWeightHint")}</span>
          </span>
        </button>
      </div>
    </Sheet>
  );
}
