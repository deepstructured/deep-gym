import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import { Card, IconChevronRight, IconDumbbell } from "@/shared/ui";
import styles from "./first-workout.module.scss";

const STEP_KEYS = [
  "firstWorkout.stepType",
  "firstWorkout.stepExercise",
  "firstWorkout.stepSave",
] as const;

/** Contextual guide shown until the athlete logs their first workout. */
export function FirstWorkoutGuideCard() {
  const { t } = useI18n();

  return (
    <Card variant="surface" className={styles.guideCard}>
      <div className={styles.guideGlow} />
      <div className={styles.guideInner}>
        <div className={styles.guideHeader}>
          <span className={styles.guideIcon}>
            <IconDumbbell size={19} />
          </span>
          <div className={styles.guideText}>
            <h2 className={styles.guideTitle}>
              {t("firstWorkout.guideTitle")}
            </h2>
            <p className={styles.guideBody}>{t("firstWorkout.guideBody")}</p>
          </div>
        </div>

        <ol className={styles.steps}>
          {STEP_KEYS.map((key, index) => (
            <li key={key} className={styles.step}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <span className={styles.stepText}>{t(key)}</span>
            </li>
          ))}
        </ol>

        <Link href="/workouts/new?first=1" className={styles.guideCta}>
          {t("firstWorkout.open")}
          <IconChevronRight size={17} />
        </Link>
      </div>
    </Card>
  );
}
