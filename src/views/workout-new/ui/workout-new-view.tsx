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
import { useI18n } from "@/shared/i18n";
import { AppShell } from "@/widgets/app-shell";
import { Button, ErrorNote, PageLoader } from "@/shared/ui";

export function WorkoutNewView() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: profile } = useProfile();
  const { draft, setDraft, reset } = useNewWorkoutDraft();
  const createWorkout = useCreateWorkout();
  const [error, setError] = useState<string | null>(null);

  // zustand/persist rehydrates on the client — render after mount to avoid
  // hydration mismatch with a stored draft.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ?type=Upper (e.g. from the next-workout widget) preselects the type.
  // Read via window.location instead of useSearchParams to skip the
  // Suspense boundary Next requires for the latter.
  useEffect(() => {
    if (!mounted) return;
    const type = new URLSearchParams(window.location.search).get("type");
    if (type && type !== useNewWorkoutDraft.getState().draft.type) {
      const { draft: current, setDraft: apply } = useNewWorkoutDraft.getState();
      apply({ ...current, type });
    }
  }, [mounted]);

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
      {!mounted ? (
        <PageLoader />
      ) : (
        <div className="space-y-5">
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
              className="w-full"
              onClick={save}
              loading={createWorkout.isPending}
            >
              {t("workout.save")}
            </Button>
          )}

          {(draft.exercises.length > 0 || draft.notes) && (
            <button
              type="button"
              className="w-full pb-2 text-center text-sm text-faint"
              onClick={reset}
            >
              {t("workout.discard")}
            </button>
          )}
        </div>
      )}
    </AppShell>
  );
}
