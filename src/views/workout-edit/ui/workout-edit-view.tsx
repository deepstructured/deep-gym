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
import { AppShell } from "@/widgets/app-shell";
import { Button, ConfirmSheet, ErrorNote, PageLoader } from "@/shared/ui";

export function WorkoutEditView({ workoutId }: { workoutId: string }) {
  const router = useRouter();
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
      title="Edit workout"
      back
      action={
        <Button
          variant="lime"
          size="sm"
          onClick={save}
          disabled={!canSave}
          loading={updateWorkout.isPending}
        >
          Save
        </Button>
      }
    >
      {isLoading || !draft ? (
        loadError ? (
          <ErrorNote message="Workout not found" />
        ) : (
          <PageLoader />
        )
      ) : (
        <div className="space-y-5">
          <WorkoutForm value={draft} onChange={setDraft} unit={unit} />
          {error && <ErrorNote message={error} />}
          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={save}
            disabled={!canSave}
            loading={updateWorkout.isPending}
          >
            Save changes
          </Button>
          <Button
            variant="danger"
            size="lg"
            className="w-full"
            onClick={() => setConfirmDelete(true)}
            disabled={updateWorkout.isPending}
            loading={deleteWorkout.isPending}
          >
            Delete workout
          </Button>
        </div>
      )}

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete workout?"
        message="This removes the workout with all its sets. There is no undo."
        loading={deleteWorkout.isPending}
        onConfirm={remove}
      />
    </AppShell>
  );
}
