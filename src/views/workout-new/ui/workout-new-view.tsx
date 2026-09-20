"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useBodyWeightMeasurements } from "@/entities/body-weight";
import { useMuscleGroups } from "@/entities/muscle-group";
import {
  getWorkoutTemplate,
  type WorkoutTemplate,
} from "@/entities/workout-template";
import {
  getWorkout,
  isWarmupsUnsupportedError,
  isWorkoutLoadModeMismatchError,
  useCreateWorkout,
} from "@/entities/workout";
import { useProfile } from "@/entities/user";
import { BodyWeightTracker } from "@/features/body-weight";
import { FirstWorkoutFormTip } from "@/features/first-workout";
import {
  DraftSummary,
  WorkoutMetaControls,
  WorkoutForm,
  bodyweightDraftIssue,
  draftBodyWeightKg,
  draftToInput,
  exerciseToDraft,
  isDraftEmpty,
  rebaseBodyweightExercises,
  useNewWorkoutDraft,
  useNewWorkoutDraftSync,
  workoutToCopiedExercises,
  type DraftExercise,
} from "@/features/workout-form";
import { useI18n } from "@/shared/i18n";
import { kgToUnit, roundWeight } from "@/shared/lib/weight";
import { AppShell } from "@/widgets/app-shell";
import {
  Button,
  ConfirmSheet,
  ErrorNote,
  IconTrash,
  PageLoader,
} from "@/shared/ui";
import styles from "./workout-new-view.module.scss";

const EMPTY_TEMPLATE = "EMPTY_TEMPLATE";

export function WorkoutNewView() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: profile } = useProfile();
  const { data: groups } = useMuscleGroups();
  const { draft, setDraft, reset } = useNewWorkoutDraft();
  const createWorkout = useCreateWorkout();
  const [error, setError] = useState<string | null>(null);
  const [isFirstWorkout, setIsFirstWorkout] = useState(false);
  const [bodyWeightPending, setBodyWeightPending] = useState(false);
  const [launchPending, setLaunchPending] = useState(false);
  // A template or "repeat workout" launch waiting for confirmation because
  // it would replace a draft that already has content.
  const [pendingReplace, setPendingReplace] = useState<{
    type: string;
    exercises: DraftExercise[];
  } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const handledLaunch = useRef<string | null>(null);

  // Renders a loader until the cloud draft pull settles — this both avoids
  // a hydration mismatch with the locally stored draft and stops a fresher
  // remote draft from replacing a form the user is already editing.
  const { ready } = useNewWorkoutDraftSync();
  const unit = profile?.unit ?? "kg";
  const bodyWeightCutoff = /^\d{4}-\d{2}-\d{2}$/.test(draft.date)
    ? new Date(`${draft.date}T23:59:59.999`).toISOString()
    : undefined;
  const { data: bodyWeightMeasurements, isLoading: bodyWeightLoading } =
    useBodyWeightMeasurements({
      to: bodyWeightCutoff,
      limit: 1,
      enabled: ready && Boolean(profile),
    });

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

  // While the snapshot is automatic, use the newest measurement available on
  // or before the selected workout date. A manually logged value is sticky.
  useEffect(() => {
    if (!ready || !profile || bodyWeightLoading) return;
    const store = useNewWorkoutDraft.getState();
    const current = store.draft;
    const automatic =
      current.bodyWeightAuto === true || !(current.bodyWeight ?? "").trim();
    if (!automatic) return;

    const cachedAt = profile.body_weight_measured_at
      ? new Date(profile.body_weight_measured_at).getTime()
      : null;
    const cutoffAt = bodyWeightCutoff
      ? new Date(bodyWeightCutoff).getTime()
      : null;
    const cachedEligible =
      profile.body_weight_kg != null &&
      cachedAt != null &&
      cutoffAt != null &&
      cachedAt <= cutoffAt;
    const selectedKg =
      bodyWeightMeasurements?.[0]?.weight_kg ??
      (cachedEligible ? profile.body_weight_kg : null);
    const nextValue =
      selectedKg != null
        ? String(roundWeight(kgToUnit(selectedKg, unit)))
        : "";
    if (
      nextValue === (current.bodyWeight ?? "") &&
      current.bodyWeightAuto === true &&
      current.bodyWeightUnit === unit
    ) {
      return;
    }
    store.setDraft({
      ...current,
      bodyWeight: nextValue,
      bodyWeightUnit: unit,
      bodyWeightAuto: true,
      exercises: rebaseBodyweightExercises(current.exercises, selectedKg),
    });
  }, [
    bodyWeightCutoff,
    bodyWeightLoading,
    bodyWeightMeasurements,
    profile,
    ready,
    unit,
  ]);

  // A template (?template=) or a past workout (?repeat=) is an explicit
  // launch intent. It is resolved after the cloud-draft pull so remote
  // persistence cannot overwrite it. A meaningful draft needs confirmation.
  useEffect(() => {
    if (!ready || !profile || !groups) return;
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get("template");
    const repeatId = params.get("repeat");
    const launch = templateId
      ? `template:${templateId}`
      : repeatId
        ? `repeat:${repeatId}`
        : null;
    if (!launch || handledLaunch.current === launch) return;
    handledLaunch.current = launch;
    setLaunchPending(true);

    const groupNames = new Map(groups.map((group) => [group.id, group.name]));
    const resolve: Promise<{ type: string; exercises: DraftExercise[] }> =
      templateId
        ? getWorkoutTemplate(templateId).then((template) => {
            if (template.workout_template_exercises.length === 0) {
              throw new Error(EMPTY_TEMPLATE);
            }
            return {
              type: template.type,
              exercises: templateExercises(template, groupNames),
            };
          })
        : getWorkout(repeatId!).then((workout) => ({
            type: workout.type,
            exercises: workoutToCopiedExercises(
              workout,
              groupNames,
              unit,
              "full",
            ),
          }));

    void resolve
      .then((next) => {
        const current = useNewWorkoutDraft.getState().draft;
        if (isDraftEmpty(current)) applyLaunch(next);
        else setPendingReplace(next);
      })
      .catch((cause: Error) => {
        setError(
          cause.message === EMPTY_TEMPLATE
            ? t("templates.exercisesRequired")
            : templateId
              ? t("templates.notFound")
              : t("workout.notFound"),
        );
        consumeLaunchParams();
      })
      .finally(() => setLaunchPending(false));
  }, [groups, profile, ready, t]);

  const canSave =
    draft.exercises.length > 0 &&
    !createWorkout.isPending &&
    !bodyWeightPending &&
    !launchPending;

  // Desktop muscle memory: Cmd/Ctrl+S saves without reaching for the button.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "s" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (canSave) save();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function consumeLaunchParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete("template");
    url.searchParams.delete("repeat");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  function templateExercises(
    template: WorkoutTemplate,
    groupNames: Map<string, string>,
  ): DraftExercise[] {
    const bodyWeightKg = draftBodyWeightKg(
      useNewWorkoutDraft.getState().draft,
      unit,
    );
    return template.workout_template_exercises.map((item) =>
      exerciseToDraft(
        item.exercise,
        groupNames.get(item.exercise.muscle_group_id) ?? "",
        unit,
        bodyWeightKg,
      ),
    );
  }

  function applyLaunch(next: { type: string; exercises: DraftExercise[] }) {
    const store = useNewWorkoutDraft.getState();
    const current = store.draft;
    const explicitType = new URLSearchParams(window.location.search).get(
      "type",
    );
    store.setDraft({
      ...current,
      type: explicitType || next.type,
      notes: "",
      showNotes: false,
      exercises: rebaseBodyweightExercises(
        next.exercises,
        draftBodyWeightKg(current, unit),
      ),
    });
    setPendingReplace(null);
    consumeLaunchParams();
  }

  function discard() {
    reset();
    setError(null);
    setConfirmDiscard(false);
  }

  function save() {
    if (bodyWeightPending) return;
    setError(null);
    const bodyweightIssue = bodyweightDraftIssue(draft, unit);
    if (bodyweightIssue) {
      setError(
        t(
          bodyweightIssue === "missing-body-weight"
            ? "bodyWeight.requiredForAddedLoad"
            : bodyweightIssue === "nonpositive-total"
              ? "bodyWeight.invalidTotalLoad"
              : "bodyWeight.invalidAddedLoad",
        ),
      );
      return;
    }
    createWorkout.mutate(draftToInput(draft, unit), {
      onSuccess: () => {
        reset();
        router.push(isFirstWorkout ? "/history?first=1" : "/history");
      },
      onError: (e) =>
        setError(
          isWorkoutLoadModeMismatchError(e)
            ? t("workout.staleExerciseMode")
            : isWarmupsUnsupportedError(e)
              ? t("workout.warmupsUnsupported")
              : (e as Error).message,
        ),
    });
  }

  return (
    <AppShell
      title={t("workout.new")}
      back
      aside={ready ? <DraftSummary draft={draft} unit={unit} /> : undefined}
      action={
        <div className={styles.headerActions}>
          {ready && (
            <WorkoutMetaControls
              type={draft.type}
              date={draft.date}
              onTypeChange={(type) => setDraft({ ...draft, type })}
              onDateChange={(date) => setDraft({ ...draft, date })}
            />
          )}
          {ready && !isDraftEmpty(draft) && (
            <button
              type="button"
              aria-label={t("workout.discard")}
              onClick={() => setConfirmDiscard(true)}
              disabled={bodyWeightPending || createWorkout.isPending}
              className={styles.discardButton}
            >
              <IconTrash size={17} />
            </button>
          )}
          <Button
            variant="lime"
            size="sm"
            onClick={save}
            disabled={!canSave}
            loading={createWorkout.isPending}
          >
            {t("common.save")}
          </Button>
        </div>
      }
    >
      {!ready || launchPending ? (
        <PageLoader variant="form" />
      ) : (
        <div className={styles.stack}>
          {isFirstWorkout && <FirstWorkoutFormTip />}

          <WorkoutForm
            value={draft}
            onChange={setDraft}
            unit={unit}
            enableCopyLast
          />

          <BodyWeightTracker
            source="workout"
            measuredAt={draft.date}
            initialWeightKg={draftBodyWeightKg(draft, unit)}
            onPendingChange={setBodyWeightPending}
            onLogged={(measurement) => {
              const store = useNewWorkoutDraft.getState();
              const current = store.draft;
              store.setDraft({
                ...current,
                bodyWeight: String(
                  roundWeight(kgToUnit(measurement.weight_kg, unit)),
                ),
                bodyWeightUnit: unit,
                bodyWeightAuto: false,
                exercises: rebaseBodyweightExercises(
                  current.exercises,
                  measurement.weight_kg,
                ),
              });
            }}
          />

          {error && <ErrorNote message={error} />}

          {draft.exercises.length > 0 && (
            <Button
              variant="gradient"
              size="lg"
              block
              className={styles.saveButton}
              onClick={save}
              disabled={!canSave}
              loading={createWorkout.isPending}
            >
              {t("workout.save")}
            </Button>
          )}
        </div>
      )}

      <ConfirmSheet
        open={pendingReplace != null}
        onClose={() => {
          setPendingReplace(null);
          consumeLaunchParams();
        }}
        title={t("workout.templateReplaceTitle")}
        message={t("workout.templateReplaceMessage")}
        confirmLabel={t("workout.templateReplaceConfirm")}
        onConfirm={() => pendingReplace && applyLaunch(pendingReplace)}
      />

      <ConfirmSheet
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={t("workout.discardTitle")}
        message={t("workout.discardMessage")}
        confirmLabel={t("workout.discard")}
        onConfirm={discard}
      />
    </AppShell>
  );
}
