import { useI18n } from "@/shared/i18n";
import { Button, IconCheck, Sheet } from "@/shared/ui";
import styles from "./first-workout.module.scss";

interface FirstWorkoutSuccessSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Completion moment after the first workout reaches History. */
export function FirstWorkoutSuccessSheet({
  open,
  onClose,
}: FirstWorkoutSuccessSheetProps) {
  const { t } = useI18n();

  return (
    <Sheet open={open} onClose={onClose} title={t("firstWorkout.savedTitle")}>
      <div className={styles.successGlyph}>
        <IconCheck size={26} />
      </div>
      <p className={styles.successBody}>{t("firstWorkout.savedBody")}</p>
      <Button
        type="button"
        variant="lime"
        size="lg"
        block
        className={styles.successCta}
        onClick={onClose}
      >
        {t("firstWorkout.openHistory")}
      </Button>
    </Sheet>
  );
}
