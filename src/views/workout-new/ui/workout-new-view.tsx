"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCreateWorkout } from "@/entities/workout";
import { useProfile } from "@/entities/user";
import {
  WorkoutForm,
  draftToInput,
  useNewWorkoutDraft,
} from "@/features/workout-form";
import { AppShell } from "@/widgets/app-shell";
import { Button, ErrorNote, PageLoader } from "@/shared/ui";

export function WorkoutNewView() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { draft, setDraft, reset } = useNewWorkoutDraft();
  const createWorkout = useCreateWorkout();
  const [error, setError] = useState<string | null>(null);

  // zustand/persist rehydrates on the client — render after mount to avoid
  // hydration mismatch with a stored draft.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const unit = profile?.unit ?? "kg";
  const canSave = draft.exercises.length > 0 && !createWorkout.isPending;

  function save() {
    setError(null);
    createWorkout.mutate(draftToInput(draft, unit), {
      onSuccess: () => {
        reset();
        router.push("/history");
      },
      onError: (e) => setError((e as Error).message),
    });
  }

  return (
    <AppShell
      title="New workout"
      back
      action={
        <Button
          variant="lime"
          size="sm"
          onClick={save}
          disabled={!canSave}
          loading={createWorkout.isPending}
        >
          Save
        </Button>
      }
    >
      {!mounted ? (
        <PageLoader />
      ) : (
        <div className="space-y-5">
          <WorkoutForm value={draft} onChange={setDraft} unit={unit} />

          {error && <ErrorNote message={error} />}

          {draft.exercises.length > 0 && (
            <Button
              variant="gradient"
              size="lg"
              className="w-full"
              onClick={save}
              loading={createWorkout.isPending}
            >
              Save workout
            </Button>
          )}

          {(draft.exercises.length > 0 || draft.notes) && (
            <button
              type="button"
              className="w-full pb-2 text-center text-sm text-faint"
              onClick={reset}
            >
              Discard draft
            </button>
          )}
        </div>
      )}
    </AppShell>
  );
}
