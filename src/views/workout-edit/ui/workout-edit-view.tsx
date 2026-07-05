"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMuscleGroups } from "@/entities/muscle-group";
import { useProfile } from "@/entities/user";
import { useUpdateWorkout, useWorkout } from "@/entities/workout";
import {
  WorkoutForm,
  draftToInput,
  workoutToDraft,
  type WorkoutDraft,
} from "@/features/workout-form";
import { AppShell } from "@/widgets/app-shell";
import { Button, ErrorNote, PageLoader } from "@/shared/ui";

export function WorkoutEditView({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: workout, isLoading, error: loadError } = useWorkout(workoutId);
  const { data: groups } = useMuscleGroups();
  const updateWorkout = useUpdateWorkout();

  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    draft != null && draft.exercises.length > 0 && !updateWorkout.isPending;

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
        </div>
      )}
    </AppShell>
  );
}
