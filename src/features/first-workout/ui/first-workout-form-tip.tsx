import { useI18n } from "@/shared/i18n";
import { IconInfo } from "@/shared/ui";
import styles from "./first-workout.module.scss";

/** Compact help that keeps the guided first-workout flow in context. */
export function FirstWorkoutFormTip() {
  const { t } = useI18n();

  return (
    <div role="note" className={styles.tip}>
      <span className={styles.tipIcon}>
        <IconInfo size={17} />
      </span>
      <p className={styles.tipText}>{t("firstWorkout.formTip")}</p>
    </div>
  );
}
