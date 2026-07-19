"use client";

import { useState } from "react";
import {
  WEEKDAY_INDICES,
  normalizeTrainingSchedule,
  scheduleForStorage,
  useUpdateProfile,
  type TrainingSchedule,
} from "@/entities/user";
import { useI18n } from "@/shared/i18n";
import { Button, Card, ErrorNote } from "@/shared/ui";
import styles from "./training-week-card.module.scss";
import { hasIncompleteTrainingDays } from "../model/presets";
import { TrainingWeekEditor } from "./training-week-editor";

export function TrainingWeekCard({
  value,
}: {
  value: TrainingSchedule | null | undefined;
}) {
  const { t } = useI18n();
  const updateProfile = useUpdateProfile();
  const [draft, setDraft] = useState<TrainingSchedule>(() =>
    normalizeTrainingSchedule(value),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const baseline = normalizeTrainingSchedule(value);
  const dirty = WEEKDAY_INDICES.some(
    (weekday) => draft[weekday] !== baseline[weekday],
  );
  const incomplete = hasIncompleteTrainingDays(draft);

  function changeDraft(value: TrainingSchedule) {
    setSaved(false);
    setError(null);
    setDraft(value);
  }

  function save() {
    if (!dirty || incomplete) return;
    setError(null);
    updateProfile.mutate(
      { training_schedule: scheduleForStorage(draft) },
      {
        onSuccess: () => setSaved(true),
        onError: (cause) => setError((cause as Error).message),
      },
    );
  }

  return (
    <Card variant="surface" className={styles.card}>
      <div>
        <div className={styles.titleRow}>
          <span className={styles.dot} />
          <p className={styles.title}>{t("settings.trainingWeek")}</p>
        </div>
        <p className={styles.hint}>{t("settings.trainingWeekHint")}</p>
      </div>

      <TrainingWeekEditor value={draft} onChange={changeDraft} />
      {error && <ErrorNote message={error} />}
      {saved && !dirty && (
        <p className={styles.savedNote}>{t("settings.scheduleSaved")}</p>
      )}

      <Button
        type="button"
        variant="lime"
        block
        disabled={!dirty || incomplete}
        loading={updateProfile.isPending}
        onClick={save}
      >
        {t("settings.saveSchedule")}
      </Button>
    </Card>
  );
}
