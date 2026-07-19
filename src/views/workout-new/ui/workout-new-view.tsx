"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCreateWorkout } from "@/entities/workout";
import { useProfile } from "@/entities/user";
import { FirstWorkoutFormTip } from "@/features/first-workout";
import {
  WorkoutForm,
  draftToInput,
  useNewWorkoutDraft,
  useNewWorkoutDraftSync,
} from "@/features/workout-form";
import { useI18n } from "@/shared/i18n";
import { AppShell } from "@/widgets/app-shell";
import { Button, ErrorNote, PageLoader } from "@/shared/ui";
import styles from "./workout-new-view.module.scss";

export function WorkoutNewView() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: profile } = useProfile();
  const { draft, setDraft, reset } = useNewWorkoutDraft();
  const createWorkout = useCreateWorkout();
  const [error, setError] = useState<string | null>(null);
  const [isFirstWorkout, setIsFirstWorkout] = useState(false);

  // Renders a loader until the cloud draft pull settles — this both avoids
  // a hydration mismatch with the locally stored draft and stops a fresher
  // remote draft from replacing a form the user is already editing.
  const { ready } = useNewWorkoutDraftSync();

  // Scheduled-workout cards preselect both the workout type and its date.
  // Read via window.location instead of useSearchParams to skip the
  // Suspense boundary Next requires for the latter. Runs after the cloud
  // pull so an explicit "start this scheduled workout" tap wins over it.
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(window.location.search);
    setIsFirstWorkout(params.get("first") === "1");
    const type = params.get("type");
    const date = params.get("date");
    const scheduledDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    const { draft: current, setDraft: apply } = useNewWorkoutDraft.getState();
    const next = {
      ...current,
      type: type || current.type,
      date: scheduledDate ?? current.date,
    };
    if (next.type !== current.type || next.date !== current.date) {
      apply(next);
    }
  }, [ready]);

  const unit = profile?.unit ?? "kg";
  const canSave = draft.exercises.length > 0 && !createWorkout.isPending;

  function save() {
    setError(null);
    createWorkout.mutate(draftToInput(draft, unit), {
      onSuccess: () => {
        reset();
        router.push(isFirstWorkout ? "/history?first=1" : "/history");
      },
      onError: (e) => setError((e as Error).message),
    });
  }

  return (
    <AppShell
      title={t("workout.new")}
      back
      action={
        <Button
          variant="lime"
          size="sm"
          onClick={save}
          disabled={!canSave}
          loading={createWorkout.isPending}
        >
          {t("common.save")}
        </Button>
      }
    >
      {!ready ? (
        <PageLoader />
      ) : (
        <div className={styles.stack}>
          {isFirstWorkout && <FirstWorkoutFormTip />}

          <WorkoutForm
            value={draft}
            onChange={setDraft}
            unit={unit}
            enableCopyLast
          />

          {error && <ErrorNote message={error} />}

          {draft.exercises.length > 0 && (
            <Button
              variant="gradient"
              size="lg"
              block
              onClick={save}
              loading={createWorkout.isPending}
            >
              {t("workout.save")}
            </Button>
          )}

          {(draft.exercises.length > 0 || draft.notes) && (
            <button type="button" className={styles.discard} onClick={reset}>
              {t("workout.discard")}
            </button>
          )}
        </div>
      )}
    </AppShell>
  );
}
