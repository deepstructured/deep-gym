"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMuscleGroups } from "@/entities/muscle-group";
import { useProfile } from "@/entities/user";
import {
  useDeleteWorkout,
  useUpdateWorkout,
  useWorkout,
} from "@/entities/workout";
import {
  WorkoutForm,
  draftToInput,
  workoutToDraft,
  type WorkoutDraft,
} from "@/features/workout-form";
import { ShareWorkoutButton } from "@/features/workout-share";

// Sticker sharing is parked until a future update — flip on to test locally.
const ENABLE_WORKOUT_SHARE = false;
import { useI18n } from "@/shared/i18n";
import { AppShell } from "@/widgets/app-shell";
import { Button, ConfirmSheet, ErrorNote, PageLoader } from "@/shared/ui";
import styles from "./workout-edit-view.module.scss";

export function WorkoutEditView({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const { data: profile } = useProfile();
  const { data: workout, isLoading, error: loadError } = useWorkout(workoutId);
  const { data: groups } = useMuscleGroups();
  const updateWorkout = useUpdateWorkout();
  const deleteWorkout = useDeleteWorkout();

  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const unit = profile?.unit ?? "kg";

  useEffect(() => {
    if (workout && groups && !draft) {
      const groupNames = new Map(groups.map((g) => [g.id, g.name]));
      setDraft(workoutToDraft(workout, groupNames, unit));
    }
  }, [workout, groups, draft, unit]);

  function save() {
    if (!draft) return;
    setError(null);
    updateWorkout.mutate(
      { id: workoutId, input: draftToInput(draft, unit) },
      {
        onSuccess: () => router.back(),
        onError: (e) => setError((e as Error).message),
      },
    );
  }

  const canSave =
    draft != null &&
    draft.exercises.length > 0 &&
    !updateWorkout.isPending &&
    !deleteWorkout.isPending;

  function remove() {
    setError(null);
    deleteWorkout.mutate(workoutId, {
      onSuccess: () => {
        setConfirmDelete(false);
        router.replace("/history");
      },
      onError: (e) => {
        setConfirmDelete(false);
        setError((e as Error).message);
      },
    });
  }

  return (
    <AppShell
      title={t("workout.edit")}
      back
      action={
        <Button
          variant="lime"
          size="sm"
          onClick={save}
          disabled={!canSave}
          loading={updateWorkout.isPending}
        >
          {t("common.save")}
        </Button>
      }
    >
      {isLoading || !draft ? (
        loadError ? (
          <ErrorNote message={t("workout.notFound")} />
        ) : (
          <PageLoader />
        )
      ) : (
        <div className={styles.stack}>
          <WorkoutForm value={draft} onChange={setDraft} unit={unit} />
          {error && <ErrorNote message={error} />}
          <Button
            variant="gradient"
            size="lg"
            block
            onClick={save}
            disabled={!canSave}
            loading={updateWorkout.isPending}
          >
            {t("common.saveChanges")}
          </Button>
          {ENABLE_WORKOUT_SHARE && workout && (
            <ShareWorkoutButton workout={workout} unit={unit} />
          )}
          <Button
            variant="danger"
            size="lg"
            block
            onClick={() => setConfirmDelete(true)}
            disabled={updateWorkout.isPending}
            loading={deleteWorkout.isPending}
          >
            {t("workout.delete")}
          </Button>
        </div>
      )}

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("workout.deleteTitle")}
        message={t("workout.deleteMessage")}
        loading={deleteWorkout.isPending}
        onConfirm={remove}
      />
    </AppShell>
  );
}
