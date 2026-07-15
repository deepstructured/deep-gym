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
    <Card variant="surface" className="space-y-4 p-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-lime shadow-[0_0_12px_rgba(215,246,81,0.32)]" />
          <p className="text-sm font-semibold">{t("settings.trainingWeek")}</p>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          {t("settings.trainingWeekHint")}
        </p>
      </div>

      <TrainingWeekEditor value={draft} onChange={changeDraft} />
      {error && <ErrorNote message={error} />}
      {saved && !dirty && (
        <p className="text-center text-xs font-medium text-lime">
          {t("settings.scheduleSaved")}
        </p>
      )}

      <Button
        type="button"
        variant="lime"
        className="w-full"
        disabled={!dirty || incomplete}
        loading={updateProfile.isPending}
        onClick={save}
      >
        {t("settings.saveSchedule")}
      </Button>
    </Card>
  );
}
