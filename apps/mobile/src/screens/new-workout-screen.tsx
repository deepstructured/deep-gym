import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import type { Exercise, Workout, WorkoutTemplateExercise } from "@deepgym/core/types";
import { translateCount } from "@deepgym/core/i18n";
import { normalizeTrainingSchedule } from "@deepgym/core/training-schedule";
import { BASE_WORKOUT_TYPES } from "@deepgym/core/workout";
import { formatWeight, kgToUnit, parseSignedWeight, parseWeight, roundWeight, unitToKg } from "@deepgym/core/weight";
import { colors, fonts, radii } from "../theme";
import { BottomSheet, Button, Card, Chip, Screen, Text } from "../ui";
import {
  createDraftSet,
  DraftChangedBeforeSaveError,
  draftIsEmpty,
  exerciseToDraft,
  flushWorkoutDraftBeforeSave,
  useWorkoutDraft,
  type DraftExercise,
  type WorkoutDraft,
} from "../data/draft";
import { bodyweightDraftError, draftToInput } from "../data/draft-convert";
import { useBodyWeightMeasurements, useLogBodyWeight } from "../data/body-weight";
import { useUpdateExerciseDetail } from "../data/exercise-detail";
import { useCreateWorkout, useExercises, useMuscleGroups, useProfile, useTemplates, useWorkout, useWorkouts } from "../data/queries";
import { workoutRpcErrorKey } from "../data/workout-rpc";
import { userErrorMessage } from "../lib/user-error";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/auth-provider";
import { useI18n } from "../providers/locale-provider";
import { Header, LoadingState } from "./common";
import { fromISO, localISO } from "./format";
import { InlineExerciseCreate } from "./inline-exercise-create";
import { SortableWorkoutExercises } from "./sortable-workout-exercises";
import { WorkoutBodyweightLoad } from "./workout-bodyweight-load";
import { WorkoutCompareChip } from "./workout-compare-chip";
import { WorkoutConfirmSheet } from "./workout-confirm-sheet";
import { WorkoutExerciseHeader } from "./workout-exercise-header";
import { WorkoutGlyph } from "./workout-glyphs";
import { WorkoutPlateSheet, type WorkoutPlateContext } from "./workout-plate-sheet";
import { withWarmupSet } from "./workout-warmup";

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return localISO(new Date(year, month - 1, day)) === value;
}

function pickerDate(value: string): Date {
  if (!isValidDate(value)) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function inputDateLabel(value: string): string {
  if (!isValidDate(value)) return value;
  return pickerDate(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function draftBodyWeightKg(draft: WorkoutDraft, defaultUnit: "kg" | "lb"): number | null {
  const value = parseWeight(draft.bodyWeight);
  return value == null ? null : unitToKg(value, draft.bodyWeightUnit ?? defaultUnit);
}

function rebaseBodyweightExercises(exercises: DraftExercise[], bodyWeightKg: number | null): DraftExercise[] {
  return exercises.map((exercise) => exercise.equipment !== "bodyweight" ? exercise : {
    ...exercise,
    sets: exercise.sets.map((set) => {
      const added = parseSignedWeight(set.addedWeight ?? "") ?? 0;
      return {
        ...set,
        weight: bodyWeightKg == null ? "" : String(roundWeight(kgToUnit(bodyWeightKg, exercise.unit) + added)),
      };
    }),
  });
}

function copyWorkout(workout: Workout, defaultUnit: "kg" | "lb", currentBodyWeightKg: number | null, bodyWeightAuto: boolean): WorkoutDraft {
  return {
    type: workout.type,
    date: localISO(),
    notes: "",
    showNotes: false,
    bodyWeight: currentBodyWeightKg == null ? "" : String(roundWeight(kgToUnit(currentBodyWeightKg, defaultUnit))),
    bodyWeightUnit: defaultUnit,
    bodyWeightAuto,
    exercises: workout.workout_exercises.map((entry) => {
      const unit = entry.exercise?.unit ?? defaultUnit;
      return {
        key: `${Date.now()}-${Math.random()}`,
        exerciseId: entry.exercise_id,
        name: entry.exercise?.name ?? "",
        muscleGroupName: "",
        equipment: entry.exercise.equipment,
        machineSettings: entry.exercise.machine_settings,
        unit,
        notes: "",
        showNotes: false,
        sets: entry.sets.map((set) => ({
          key: `${Date.now()}-${Math.random()}`,
          weight: set.weight_kg == null ? "" : entry.load_mode === "bodyweight"
            ? currentBodyWeightKg == null || workout.body_weight_kg == null
              ? ""
              : String(roundWeight(kgToUnit(currentBodyWeightKg + set.weight_kg - workout.body_weight_kg, unit)))
            : String(roundWeight(kgToUnit(set.weight_kg, unit))),
          addedWeight: entry.load_mode === "bodyweight" && workout.body_weight_kg != null && set.weight_kg != null
            ? String(roundWeight(kgToUnit(set.weight_kg - workout.body_weight_kg, unit)))
            : undefined,
          reps: set.reps == null ? "" : String(set.reps),
          toFailure: set.to_failure,
          warmup: set.set_type === "warmup",
        })),
      };
    }),
  };
}

type CopyMode = "full" | "last-weight";

function copiedExercises(workout: Workout, mode: CopyMode, unit: "kg" | "lb", bodyWeightKg: number | null): DraftExercise[] {
  const exercises = copyWorkout(workout, unit, bodyWeightKg, false).exercises;
  if (mode === "full") return exercises;
  return exercises.map((exercise) => {
    const last = [...exercise.sets].reverse().find((set) => !set.warmup && set.weight.trim());
    return {
      ...exercise,
      sets: [{
        key: `${Date.now()}-${Math.random()}`,
        weight: last?.weight ?? "",
        addedWeight: last?.addedWeight,
        reps: "",
        toFailure: false,
      }],
    };
  });
}

export function NewWorkoutScreen() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ type?: string; date?: string; template?: string; repeat?: string; first?: string }>();
  const profile = useProfile();
  const exercises = useExercises();
  const groups = useMuscleGroups();
  const templates = useTemplates();
  const history = useWorkouts();
  const repeatWorkout = useWorkout(params.repeat ?? "");
  const createWorkout = useCreateWorkout();
  const updateMachine = useUpdateExerciseDetail();
  const draft = useWorkoutDraft((state) => state.draft);
  const hydrated = useWorkoutDraft((state) => state.hydrated);
  const syncReady = useWorkoutDraft((state) => state.syncReady);
  const bodyWeightCutoff = isValidDate(draft.date) ? new Date(`${draft.date}T23:59:59.999`).toISOString() : undefined;
  const bodyWeights = useBodyWeightMeasurements({ limit: 1, to: bodyWeightCutoff, enabled: syncReady && Boolean(profile.data) && Boolean(bodyWeightCutoff) });
  const logWeight = useLogBodyWeight();
  const cloudVerified = useWorkoutDraft((state) => state.cloudVerified);
  const draftOwnerId = useWorkoutDraft((state) => state.ownerId);
  const pendingRemote = useWorkoutDraft((state) => state.pendingRemote);
  const edit = useWorkoutDraft((state) => state.edit);
  const replace = useWorkoutDraft((state) => state.replace);
  const reset = useWorkoutDraft((state) => state.reset);
  const resolveConflict = useWorkoutDraft((state) => state.resolveConflict);
  const [exercisePicker, setExercisePicker] = useState(false);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null);
  const [templatePicker, setTemplatePicker] = useState(false);
  const [copyModal, setCopyModal] = useState<{ kind: "last" | "day"; source: Workout | null } | null>(null);
  const [copySelectedDay, setCopySelectedDay] = useState<string | null>(null);
  const [copyMonth, setCopyMonth] = useState(localISO().slice(0, 7));
  const [exerciseTool, setExerciseTool] = useState<{ key: string; kind: "compare" | "machine" } | null>(null);
  const [plateContext, setPlateContext] = useState<WorkoutPlateContext | null>(null);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [compareDay, setCompareDay] = useState<string | null>(null);
  const [compareCalendarOpen, setCompareCalendarOpen] = useState(false);
  const [compareMonth, setCompareMonth] = useState(localISO().slice(0, 7));
  const [machineEditing, setMachineEditing] = useState(false);
  const [machineText, setMachineText] = useState("");
  const [machineError, setMachineError] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [weightSaved, setWeightSaved] = useState(false);
  const [reordering, setReordering] = useState(false);
  const saveInFlight = useRef(false);
  const pendingTemplateCreate = useRef(false);
  const handledParams = useRef<string | null>(null);
  const pendingReplaceRef = useRef<(() => void) | null>(null);
  const replaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workoutScrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const unit = profile.data?.unit ?? "kg";
  const groupName = new Map((groups.data ?? []).map((group) => [group.id, group.name]));
  const exerciseById = new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise]));
  const filteredExercises = (exercises.data ?? []).filter((exercise) =>
    (!pickerGroupId || exercise.muscle_group_id === pickerGroupId) &&
    exercise.name.toLocaleLowerCase().includes(pickerSearch.trim().toLocaleLowerCase()),
  );
  const toolExercise = draft.exercises.find((entry) => entry.key === exerciseTool?.key);
  const liveMachineSettings = toolExercise
    ? exercises.data?.find((exercise) => exercise.id === toolExercise.exerciseId)?.machine_settings ?? toolExercise.machineSettings
    : null;
  const comparisonSessions = toolExercise
    ? (history.data ?? []).filter((workout) => workout.date < draft.date)
      .flatMap((workout) => workout.workout_exercises
        .filter((entry) => entry.exercise_id === toolExercise.exerciseId)
        .map((entry) => ({ workout, entry })))
      .sort((a, b) => b.workout.date.localeCompare(a.workout.date))
    : [];
  const compareDates = [...new Set(comparisonSessions.map(({ workout }) => workout.date))];
  const activeCompareDay = compareDay ?? compareDates[0];
  const selectedHistory = comparisonSessions.filter(({ workout }) => workout.date === activeCompareDay);
  const [compareYear, compareMonthNumber] = compareMonth.split("-").map(Number);
  const compareMonthDate = new Date(compareYear, compareMonthNumber - 1, 1, 12);
  const calendarOffset = (compareMonthDate.getDay() + 6) % 7;
  const daysInCompareMonth = new Date(compareYear, compareMonthNumber, 0).getDate();
  const calendarCells = Array.from({ length: Math.ceil((calendarOffset + daysInCompareMonth) / 7) * 7 }, (_, index) => index - calendarOffset + 1);
  const availableCompareDates = new Set(compareDates);
  const pastWorkouts = (history.data ?? []).filter((workout) => workout.date < draft.date && workout.workout_exercises.length > 0);
  const sameType = pastWorkouts.filter((workout) => workout.type === draft.type);
  const schedule = normalizeTrainingSchedule(profile.data?.training_schedule);
  const preferWeekday = schedule.filter((type) => type === draft.type).length >= 2;
  const lastOfType = preferWeekday
    ? sameType.find((workout) => fromISO(workout.date).getDay() === pickerDate(draft.date).getDay()) ?? sameType[0]
    : sameType[0];
  const copyWorkouts = (history.data ?? []).filter((workout) => workout.workout_exercises.length > 0);
  const copyMarkedDates = new Set(copyWorkouts.map((workout) => workout.date));
  const [copyYear, copyMonthNumber] = copyMonth.split("-").map(Number);
  const copyFirst = new Date(copyYear, copyMonthNumber - 1, 1, 12);
  const copyOffset = (copyFirst.getDay() + 6) % 7;
  const copyDays = new Date(copyYear, copyMonthNumber, 0).getDate();
  const copyCells = Array.from({ length: Math.ceil((copyOffset + copyDays) / 7) * 7 }, (_, index) => index - copyOffset + 1);
  const copyDayWorkouts = copyWorkouts.filter((workout) => workout.date === copySelectedDay);

  function shiftCompareMonth(step: -1 | 1) {
    setCompareMonth(localISO(new Date(compareYear, compareMonthNumber - 1 + step, 1, 12)).slice(0, 7));
  }

  function shiftCopyMonth(step: -1 | 1) {
    setCopyMonth(localISO(new Date(copyYear, copyMonthNumber - 1 + step, 1, 12)).slice(0, 7));
    setCopySelectedDay(null);
  }

  function openCompare(exercise: DraftExercise) {
    setCompareDay(null);
    setCompareCalendarOpen(false);
    setExerciseTool({ key: exercise.key, kind: "compare" });
  }

  function openPlates(exercise: DraftExercise, rawWeight: string) {
    const weight = parseWeight(rawWeight);
    if (weight == null) return;
    setPlateContext({ weightKg: unitToKg(weight, exercise.unit), equipment: exercise.equipment, unit: exercise.unit });
  }

  function openMachine(exercise: DraftExercise) {
    setMachineText(exercises.data?.find((item) => item.id === exercise.exerciseId)?.machine_settings ?? exercise.machineSettings ?? "");
    setMachineEditing(false);
    setMachineError(null);
    setExerciseTool({ key: exercise.key, kind: "machine" });
  }

  function closeExerciseTool() {
    if (updateMachine.isPending) return;
    setExerciseTool(null);
    setMachineEditing(false);
    setMachineError(null);
  }

  async function saveMachine() {
    if (!toolExercise || updateMachine.isPending) return;
    setMachineError(null);
    const settings = machineText.trim() || null;
    try {
      await updateMachine.mutateAsync({ id: toolExercise.exerciseId, patch: { machine_settings: settings } });
      updateExercise(toolExercise.key, (current) => ({ ...current, machineSettings: settings }));
      setMachineEditing(false);
    } catch (failure) {
      setMachineError(userErrorMessage(t, failure));
    }
  }

  function moveExercise(from: number, to: number) {
    patch((current) => {
      if (from < 0 || to < 0 || from >= current.exercises.length || to >= current.exercises.length) return current;
      const next = [...current.exercises];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...current, exercises: next };
    });
  }

  function closeExercisePicker() {
    setExercisePicker(false);
    setCreatingExercise(false);
    setPickerSearch("");
  }

  function patch(change: (current: WorkoutDraft) => WorkoutDraft) {
    if (!user || saveInFlight.current) return;
    edit(user.id, change);
  }

  function updateExercise(key: string, change: (entry: DraftExercise) => DraftExercise) {
    patch((current) => ({
      ...current,
      exercises: current.exercises.map((entry) => entry.key === key ? change(entry) : entry),
    }));
  }

  function chooseExercise(exercise: Exercise) {
    patch((current) => ({
      ...current,
      exercises: [...current.exercises, exerciseToDraft(
        exercise,
        groupName.get(exercise.muscle_group_id) ?? "",
        unit,
        draftBodyWeightKg(current, unit),
      )],
    }));
    closeExercisePicker();
  }

  async function applyTemplate(id: string) {
    if (saveInFlight.current) return;
    const { data, error: templateError } = await supabase
      .from("workout_templates")
      .select("*, workout_template_exercises (*, exercise:exercises (*))")
      .eq("id", id)
      .single();
    if (templateError) throw templateError;
    const entries = (data.workout_template_exercises as WorkoutTemplateExercise[])
      .sort((a, b) => a.position - b.position);
    if (entries.length === 0) {
      setError(t("templates.exercisesRequired"));
      setTemplatePicker(false);
      return;
    }
    const next: WorkoutDraft = {
      ...draft,
      type: data.type,
      exercises: entries.map((entry) => exerciseToDraft(
        entry.exercise,
        groupName.get(entry.exercise.muscle_group_id) ?? "",
        unit,
        draftBodyWeightKg(draft, unit),
      )),
    };
    if (!user || saveInFlight.current) return;
    replace(next, user.id, new Date().toISOString());
    setTemplatePicker(false);
  }

  function requestReplace(action: () => void, closePicker = false) {
    pendingReplaceRef.current = action;
    if (replaceTimerRef.current) clearTimeout(replaceTimerRef.current);
    if (closePicker) {
      setTemplatePicker(false);
      setCopyModal(null);
      replaceTimerRef.current = setTimeout(() => setConfirmReplaceOpen(true), 260);
    } else {
      setConfirmReplaceOpen(true);
    }
  }

  function closeReplace() {
    if (replaceTimerRef.current) clearTimeout(replaceTimerRef.current);
    replaceTimerRef.current = null;
    pendingReplaceRef.current = null;
    setConfirmReplaceOpen(false);
  }

  useEffect(() => () => {
    if (replaceTimerRef.current) clearTimeout(replaceTimerRef.current);
  }, []);

  useEffect(() => {
    if (!syncReady || !user || !profile.data || saveInFlight.current) return;
    const key = `${params.type ?? ""}|${params.date ?? ""}|${params.template ?? ""}`;
    if (key === "||" || handledParams.current === key) return;
    handledParams.current = key;
    if (params.template) {
      const perform = () => void applyTemplate(params.template!).catch((failure) =>
        setError(userErrorMessage(t, failure)));
      if (draftIsEmpty(useWorkoutDraft.getState().draft)) perform();
      else requestReplace(perform);
      return;
    }
    if (draftIsEmpty(useWorkoutDraft.getState().draft)) {
      edit(user.id, (current) => ({
        ...current,
        type: params.type ?? current.type,
        date: params.date && isValidDate(params.date) ? params.date : current.date,
      }));
    }
  }, [syncReady, user?.id, profile.data?.id, params.type, params.date, params.template]);

  useEffect(() => {
    if (!syncReady || !user || !profile.data || !groups.data || !params.repeat || !repeatWorkout.isFetched || saveInFlight.current) return;
    const key = `repeat:${params.repeat}`;
    if (handledParams.current === key) return;
    handledParams.current = key;
    if (!repeatWorkout.data) {
      setError(t("workout.notFound"));
      router.setParams({ repeat: "" });
      return;
    }
    const source = repeatWorkout.data;
    const perform = () => {
      const current = useWorkoutDraft.getState().draft;
      const bodyWeightKg = draftBodyWeightKg(current, unit);
      const copied = copiedExercises(source, "full", unit, bodyWeightKg).map((entry) => ({
        ...entry,
        muscleGroupName: groupName.get(exerciseById.get(entry.exerciseId)?.muscle_group_id ?? "") ?? entry.muscleGroupName,
      }));
      replace({
        ...current,
        type: params.type || source.type,
        notes: "",
        showNotes: false,
        exercises: rebaseBodyweightExercises(copied, bodyWeightKg),
      }, user.id, new Date().toISOString());
    };
    if (draftIsEmpty(useWorkoutDraft.getState().draft)) perform();
    else requestReplace(perform);
    router.setParams({ repeat: "" });
  }, [syncReady, user?.id, profile.data?.id, groups.data, params.repeat, params.type, repeatWorkout.isFetched, repeatWorkout.data]);

  // Keep an automatic workout snapshot aligned with the latest measurement
  // at or before the selected day. A manually entered weight remains sticky.
  useEffect(() => {
    if (!syncReady || !user || !profile.data || bodyWeights.isLoading || !isValidDate(draft.date) || saveInFlight.current) return;
    const current = useWorkoutDraft.getState().draft;
    if (current.bodyWeightAuto !== true && current.bodyWeight.trim()) return;
    const cutoff = new Date(`${current.date}T23:59:59.999`).getTime();
    const recorded = bodyWeights.data?.[0];
    const cachedAt = profile.data.body_weight_measured_at
      ? new Date(profile.data.body_weight_measured_at).getTime()
      : null;
    const selectedKg = recorded?.weight_kg
      ?? (cachedAt != null && cachedAt <= cutoff ? profile.data.body_weight_kg : null);
    const nextWeight = selectedKg == null ? "" : String(roundWeight(kgToUnit(selectedKg, unit)));
    if (current.bodyWeight === nextWeight && current.bodyWeightAuto === true && current.bodyWeightUnit === unit) return;
    edit(user.id, (value) => ({
      ...value,
      bodyWeight: nextWeight,
      bodyWeightUnit: unit,
      bodyWeightAuto: true,
      exercises: rebaseBodyweightExercises(value.exercises, selectedKg),
    }));
  }, [syncReady, user?.id, profile.data, bodyWeights.data, bodyWeights.isLoading, draft.date, draft.bodyWeightAuto, unit]);

  function copyLast() {
    if (saveInFlight.current) return;
    if (lastOfType) setCopyModal({ kind: "last", source: lastOfType });
  }

  function openCopyCalendar() {
    setCopyMonth(isValidDate(draft.date) ? draft.date.slice(0, 7) : localISO().slice(0, 7));
    setCopySelectedDay(null);
    setCopyModal({ kind: "day", source: null });
  }

  function applyCopy(mode: CopyMode) {
    const source = copyModal?.source;
    if (!source || !user || saveInFlight.current) return;
    const kind = copyModal.kind;
    const apply = () => {
      const current = useWorkoutDraft.getState().draft;
      const exercises = copiedExercises(source, mode, unit, draftBodyWeightKg(current, unit)).map((entry) => ({
        ...entry,
        muscleGroupName: groupName.get(exerciseById.get(entry.exerciseId)?.muscle_group_id ?? "") ?? entry.muscleGroupName,
      }));
      replace({
        ...current,
        type: kind === "day" ? source.type : current.type,
        exercises: draftIsEmpty(current) ? [...current.exercises, ...exercises] : exercises,
        notes: "",
        showNotes: false,
      }, user.id, new Date().toISOString());
      setCopyModal(null);
    };
    if (draftIsEmpty(useWorkoutDraft.getState().draft)) apply();
    else requestReplace(apply, true);
  }

  function discard() {
    if (saveInFlight.current) return;
    setConfirmDiscardOpen(true);
  }

  async function recordBodyWeight() {
    if (saveInFlight.current || logWeight.isPending) return;
    setWeightSaved(false);
    setWeightError(null);
    const parsed = parseWeight(draft.bodyWeight);
    if (parsed == null) return setWeightError(t("bodyWeight.invalid"));
    if (!isValidDate(draft.date)) return setWeightError(t("bodyWeight.invalidTimestamp"));
    const measuredAt = draft.date === localISO()
      ? new Date()
      : new Date(`${draft.date}T12:00:00`);
    if (!Number.isFinite(measuredAt.getTime()) || measuredAt.getTime() > Date.now() + 5 * 60_000) {
      return setWeightError(t("bodyWeight.invalidTimestamp"));
    }
    try {
      const measurement = await logWeight.mutateAsync({
        weightKg: Math.round(unitToKg(parsed, unit) * 1000) / 1000,
        measuredAt: measuredAt.toISOString(),
        source: "workout",
      });
      patch((current) => ({
        ...current,
        bodyWeight: String(roundWeight(kgToUnit(measurement.weight_kg, unit))),
        bodyWeightUnit: unit,
        bodyWeightAuto: false,
        exercises: rebaseBodyweightExercises(current.exercises, measurement.weight_kg),
      }));
      setWeightSaved(true);
    } catch (failure) {
      setWeightError(userErrorMessage(t, failure));
    }
  }

  async function save() {
    if (saveInFlight.current || logWeight.isPending) return;
    if (exercisePicker || templatePicker) return;
    setError(null);
    const current = useWorkoutDraft.getState();
    if (!user || current.ownerId !== user.id || !current.syncReady || !current.cloudVerified || current.pendingRemote) {
      return setError(t("workout.draftCloudPending"));
    }
    const currentDraft = current.draft;
    if (!isValidDate(currentDraft.date)) return setError(t("workout.invalidDate"));
    if (currentDraft.exercises.length === 0) return setError(t("workout.addExercise"));
    const issue = bodyweightDraftError(currentDraft, unit);
    if (issue) return setError(t(
      issue === "missing-body-weight"
        ? "bodyWeight.requiredForAddedLoad"
        : issue === "nonpositive-total"
          ? "bodyWeight.invalidTotalLoad"
          : "bodyWeight.invalidAddedLoad",
    ));
    const input = draftToInput(currentDraft, unit);
    if (!input.exercises.some((entry) => entry.sets.some((set) => set.reps != null))) {
      return setError(t("workout.completedSetRequired"));
    }
    const createKey = currentDraft.createKey;
    if (!createKey) return setError(t("workout.draftNotReady"));
    const firstSuccessfulWorkout = params.first === "1" && history.data?.length === 0;
    const savedDate = currentDraft.date;
    saveInFlight.current = true;
    setSaving(true);
    let cloudReady = false;
    try {
      await flushWorkoutDraftBeforeSave(user.id, currentDraft, current.updatedAt);
      cloudReady = true;
      const afterFlush = useWorkoutDraft.getState();
      if (afterFlush.ownerId !== user.id || afterFlush.draft !== currentDraft) {
        throw new DraftChangedBeforeSaveError("Draft changed while preparing save");
      }
      const id = await createWorkout.mutateAsync({ input, createKey });
      const afterSave = useWorkoutDraft.getState();
      if (afterSave.ownerId !== user.id || afterSave.draft !== currentDraft) {
        // The saved snapshot is available in History. Keep later edits and the
        // same key so a retry cannot silently create a second workout.
        setError(t("workout.alreadySavedConflict"));
        return;
      }
      reset(user.id);
      if (firstSuccessfulWorkout) {
        router.replace({ pathname: "/history", params: { first: "1", date: savedDate } });
      } else {
        router.replace({ pathname: "/workouts/[id]", params: { id } });
      }
    } catch (failure) {
      if (failure instanceof DraftChangedBeforeSaveError) {
        setError(t("workout.draftNotReady"));
      } else if (!cloudReady) {
        setError(t("workout.draftCloudPending"));
      } else {
        const key = workoutRpcErrorKey(failure);
        setError(key ? t(key) : userErrorMessage(t, failure));
      }
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  if (!hydrated || !syncReady || draftOwnerId !== user?.id) {
    return <Screen><Header title={t("workout.new")} back /><LoadingState /></Screen>;
  }

  return (
    <Screen
      bottomPadding={125}
      scrollEnabled={!reordering}
      scrollRef={workoutScrollRef}
      scrollEventThrottle={16}
      onScroll={(event) => { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
      pointerEvents={saving ? "none" : "auto"}
    >
      <Header
        title={t("workout.new")}
        back
        action={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {!draftIsEmpty(draft) ? (
              <Pressable onPress={discard} disabled={saving} accessibilityRole="button" accessibilityLabel={t("workout.discard")} style={[iconAction, { width: 36, height: 36 }]}>
                <WorkoutGlyph name="trash" size={17} color={colors.muted} />
              </Pressable>
            ) : null}
            <Button variant="lime" size="sm" loading={saving} disabled={!draft.exercises.length || !cloudVerified || Boolean(pendingRemote) || logWeight.isPending} onPress={save}>{t("common.save")}</Button>
          </View>
        }
      />
      {params.first === "1" ? (
        <View
          accessibilityRole="summary"
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "flex-start",
            backgroundColor: "rgba(215,246,81,0.08)",
            borderColor: "rgba(215,246,81,0.25)",
            borderWidth: 1,
            borderRadius: radii.medium,
            padding: 15,
            marginTop: 16,
          }}
        >
          <Text tone="lime" style={{ fontSize: 19, lineHeight: 23 }}>ⓘ</Text>
          <Text tone="muted" style={{ flex: 1 }}>{t("firstWorkout.mobileFormTip")}</Text>
        </View>
      ) : null}
      {!cloudVerified && !pendingRemote ? (
        <Text tone="muted" variant="caption" style={{ marginTop: 14 }}>
          {t("workout.draftCloudPending")}
        </Text>
      ) : null}
      <Text variant="caption" tone="muted" weight="medium" style={{ fontSize: 13, marginTop: 22, marginBottom: 7 }}>{t("workout.type")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 15 }}>
        {[...BASE_WORKOUT_TYPES, ...(groups.data ?? []).map((group) => `Split ${group.name}`)].map((value) => (
          <Chip key={value} selected={draft.type === value} onPress={() => patch((current) => ({ ...current, type: value }))}>{value}</Chip>
        ))}
      </ScrollView>
      <Text variant="caption" tone="muted" weight="medium" style={{ fontSize: 13, marginTop: 8, marginBottom: 7 }}>{t("workout.date")}</Text>
      <Pressable onPress={() => setDatePickerOpen(true)} disabled={saving || logWeight.isPending} accessibilityRole="button" accessibilityLabel={t("workout.date")} style={dateButtonStyle}>
        <Text>{inputDateLabel(draft.date)}</Text>
        {Platform.OS === "ios" ? null : <Ionicons name="calendar-outline" size={18} color={colors.muted} />}
      </Pressable>
      {draft.showNotes || draft.notes ? (
        <View style={{ marginBottom: 16 }}>
          <Text variant="micro" tone="muted" style={{ marginBottom: 8 }}>{t("workout.note")}</Text>
          <View>
            <TextInput
              editable={!saving}
              value={draft.notes}
              onChangeText={(notes) => patch((current) => ({ ...current, notes }))}
              placeholder={t("workout.notePlaceholder")}
              placeholderTextColor={colors.faint}
              multiline
              style={[inputStyle, { minHeight: 82, marginBottom: 0, paddingRight: 46, textAlignVertical: "top", paddingTop: 13 }]}
            />
            <Pressable
              onPress={() => patch((current) => ({ ...current, notes: "", showNotes: false }))}
              accessibilityRole="button"
              accessibilityLabel={t("workout.removeNote")}
              style={{ position: "absolute", right: 5, top: 3, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={19} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => patch((current) => ({ ...current, showNotes: true }))}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 38, marginBottom: 14 }}
        >
          <WorkoutGlyph name="note" size={17} color={colors.muted} />
          <Text tone="muted" weight="medium" style={{ fontSize: 14 }}>{t("workout.addNote")}</Text>
        </Pressable>
      )}

      {draftIsEmpty(draft) ? (
        <View style={{ gap: 16, marginBottom: 20 }}>
          {lastOfType ? (
            <Pressable onPress={copyLast} accessibilityRole="button" style={sourceCardStyle}>
              <View style={sourceIconStyle}><Ionicons name="time-outline" size={18} color={colors.lime} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="medium" numberOfLines={1}>{t("workout.copyLast", { type: draft.type })}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {fromISO(lastOfType.date).toLocaleDateString(lang, { month: "short", day: "numeric" })} · {translateCount(lang, "count.exercises", lastOfType.workout_exercises.length)}
                </Text>
              </View>
            </Pressable>
          ) : null}
          {copyWorkouts.length > 0 ? (
            <Pressable onPress={openCopyCalendar} accessibilityRole="button" style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, minHeight: 24 }}>
              <Ionicons name="calendar-outline" size={16} color={colors.muted} />
              <Text tone="muted" weight="medium" style={{ fontSize: 14 }}>{t("workout.copyFromCalendar")}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setTemplatePicker(true)} accessibilityRole="button" style={sourceCardStyle}>
            <View style={sourceIconStyle}><WorkoutGlyph name="template" size={18} color={colors.lime} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text weight="semibold" numberOfLines={1}>{t("workout.useTemplate")}</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t("workout.useTemplateHint")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.faint} />
          </Pressable>
        </View>
      ) : null}

      <SortableWorkoutExercises
        items={draft.exercises}
        onReorder={moveExercise}
        onDragChange={setReordering}
        scrollRef={workoutScrollRef}
        scrollOffsetRef={scrollOffsetRef}
        renderCard={(entry, exerciseIndex, dragHandle) => (
          <Card radius={23} padding={16}>
            <WorkoutExerciseHeader
              dragHandle={dragHandle}
              name={entry.name}
              muscleGroupName={entry.muscleGroupName || groupName.get(exerciseById.get(entry.exerciseId)?.muscle_group_id ?? "") || ""}
              machine={entry.equipment === "machine"}
              noteActive={entry.showNotes || Boolean(entry.notes)}
              onMachine={() => openMachine(entry)}
              onCompare={() => openCompare(entry)}
              onNote={() => updateExercise(entry.key, (current) => ({ ...current, showNotes: !current.showNotes }))}
              onRemove={() => patch((current) => ({ ...current, exercises: current.exercises.filter((item) => item.key !== entry.key) }))}
            />
            <View style={{ flexDirection: "row", marginBottom: 7, gap: 5, alignItems: "center" }}>
              <Text variant="micro" tone="faint" style={{ width: 26 }}>#</Text>
              <Text variant="micro" tone="faint" style={{ flex: 1 }}>
                {entry.equipment === "bodyweight" ? t("set.addedLoad", { unit: entry.unit }).toUpperCase() : t("set.weight", { unit: entry.unit }).toUpperCase()}
              </Text>
              <Text variant="micro" tone="faint" style={{ flex: 1 }}>{t("set.reps").toUpperCase()}</Text>
              <Text variant="micro" tone="faint" style={{ width: 36, textAlign: "center" }}>{t("set.fail").toUpperCase()}</Text>
              <View style={{ width: 28 }} />
            </View>
            {entry.sets.map((set, setIndex) => (
              <View key={set.key} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 }}>
                <Pressable
                  onPress={() => updateExercise(entry.key, (current) => ({
                    ...current,
                    sets: current.sets.map((item) => item.key === set.key
                      ? { ...item, warmup: !item.warmup, toFailure: false }
                      : item),
                  }))}
                  accessibilityRole="button"
                  accessibilityLabel={t(set.warmup ? "set.markWorking" : "set.markWarmup")}
                  style={{ width: 26, height: 29, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: set.warmup ? "rgba(24,39,136,0.35)" : "transparent", borderColor: set.warmup ? "rgba(64,84,214,0.38)" : "transparent", borderWidth: 1 }}
                >
                  <Text variant="caption" tone={set.warmup ? "white" : "faint"} style={{ fontFamily: set.warmup ? fonts.semibold : fonts.dot, fontSize: set.warmup ? 11 : 14 }}>
                    {set.warmup ? t("set.warmupShort") : entry.sets.slice(0, setIndex + 1).filter((item) => !item.warmup).length}
                  </Text>
                </Pressable>
                {entry.equipment === "bodyweight" ? (
                  <WorkoutBodyweightLoad
                    bodyWeightKg={draftBodyWeightKg(draft, unit)}
                    unit={entry.unit}
                    addedWeight={set.addedWeight ?? ""}
                    warmup={set.warmup}
                    editable={!saving}
                    onChange={(addedWeight) => {
                      const base = draftBodyWeightKg(draft, unit);
                      const total = base == null ? "" : String(roundWeight(kgToUnit(base, entry.unit) + (parseSignedWeight(addedWeight) ?? 0)));
                      updateExercise(entry.key, (current) => ({
                        ...current,
                        sets: current.sets.map((item) => item.key === set.key ? { ...item, addedWeight, weight: total } : item),
                      }));
                    }}
                  />
                ) : (
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <TextInput
                      editable={!saving}
                      value={set.weight}
                      onChangeText={(value) => updateExercise(entry.key, (current) => ({
                        ...current,
                        sets: current.sets.map((item) => item.key === set.key ? { ...item, weight: value.replace(/[^\d.,]/g, "") } : item),
                      }))}
                      keyboardType="numbers-and-punctuation"
                      placeholder="0"
                      placeholderTextColor={colors.faint}
                      style={[inputStyle, { marginBottom: 0, height: 44, minHeight: 44, paddingHorizontal: 9, paddingRight: entry.equipment !== "crossover" ? 31 : 9, backgroundColor: set.warmup ? "rgba(24,39,136,0.12)" : colors.raised, borderColor: set.warmup ? "rgba(64,84,214,0.18)" : colors.line }]}
                    />
                    {entry.equipment !== "crossover" ? (
                      <Pressable onPress={() => openPlates(entry, set.weight)} disabled={parseWeight(set.weight) == null} accessibilityRole="button" accessibilityLabel={t("set.plates")} style={{ position: "absolute", right: 4, top: 0, width: 28, height: 44, alignItems: "center", justifyContent: "center", opacity: parseWeight(set.weight) == null ? 0.35 : 1 }}>
                        <WorkoutGlyph name="plates" size={18} color={colors.faint} />
                      </Pressable>
                    ) : null}
                  </View>
                )}
                <TextInput
                  editable={!saving}
                  value={set.reps}
                  onChangeText={(value) => updateExercise(entry.key, (current) => ({
                    ...current,
                    sets: current.sets.map((item) => item.key === set.key ? { ...item, reps: value.replace(/\D/g, "") } : item),
                  }))}
                  keyboardType="number-pad"
                  placeholder={set.warmup ? String([10, 5, 3][Math.min(entry.sets.slice(0, setIndex + 1).filter((item) => item.warmup).length - 1, 2)]) : "0"}
                  placeholderTextColor={colors.faint}
                  style={[inputStyle, { flex: 1, marginBottom: 0, height: 44, minHeight: 44, paddingHorizontal: 9, backgroundColor: set.warmup ? "rgba(24,39,136,0.12)" : colors.raised, borderColor: set.warmup ? "rgba(64,84,214,0.18)" : colors.line }]}
                />
                {set.warmup ? <View style={{ width: 36, height: 36 }} /> : (
                  <Pressable
                    onPress={() => updateExercise(entry.key, (current) => ({
                      ...current,
                      sets: current.sets.map((item) => item.key === set.key ? { ...item, toFailure: !item.toFailure } : item),
                    }))}
                    accessibilityRole="switch"
                    accessibilityLabel={t("set.toFailure")}
                    accessibilityState={{ checked: set.toFailure }}
                    style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: set.toFailure ? "rgba(224,75,46,0.5)" : colors.line, backgroundColor: set.toFailure ? "rgba(224,75,46,0.2)" : colors.raised, justifyContent: "center", alignItems: "center" }}
                  >
                    <WorkoutGlyph name="flame" size={17} color={set.toFailure ? colors.flameText : colors.faint} />
                  </Pressable>
                )}
                <Pressable
                  onPress={() => updateExercise(entry.key, (current) => ({
                    ...current,
                    sets: current.sets.length > 1 ? current.sets.filter((item) => item.key !== set.key) : current.sets,
                  }))}
                  disabled={entry.sets.length === 1}
                  accessibilityRole="button"
                  accessibilityLabel={t("set.removeSet")}
                  style={{ width: 28, height: 38, alignItems: "center", justifyContent: "center", opacity: entry.sets.length === 1 ? 0.3 : 1 }}
                >
                  <Ionicons name="close" size={18} color={colors.faint} />
                </Pressable>
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 9 }}>
              <Button variant="ghost" size="sm" leading={<Ionicons name="add" size={18} color={colors.lime} />} textStyle={{ color: colors.lime }} onPress={() => updateExercise(entry.key, (current) => ({
                ...current,
                sets: [...current.sets, createDraftSet(current.sets.findLast((item) => !item.warmup) ?? current.sets.at(-1))],
              }))}>{t("set.addSet")}</Button>
              <Button variant="ghost" size="sm" leading={<Ionicons name="add" size={18} color="#aeb8ff" />} textStyle={{ color: "#aeb8ff" }} onPress={() => updateExercise(entry.key, (current) => ({
                ...current,
                sets: withWarmupSet(current),
              }))}>{t("set.addWarmup")}</Button>
            </View>
            {entry.showNotes ? (
              <View style={{ marginTop: 9 }}>
                <TextInput
                  editable={!saving}
                  value={entry.notes}
                  onChangeText={(notes) => updateExercise(entry.key, (current) => ({ ...current, notes }))}
                  placeholder={t("exercise.notePlaceholder")}
                  placeholderTextColor={colors.faint}
                  multiline
                  style={[inputStyle, { minHeight: 68, marginBottom: 0, textAlignVertical: "top", paddingTop: 12 }]}
                />
              </View>
            ) : null}
          </Card>
        )}
      />

      <Button variant="surface" block dashed leading={<Ionicons name="add" size={20} color={colors.lime} />} textStyle={{ color: colors.lime }} style={{ marginTop: 16, height: 56, backgroundColor: "transparent" }} onPress={() => setExercisePicker(true)}>
        {t("workout.addExercise")}
      </Button>
      <Card radius={21} padding={17} style={{ marginTop: 23, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text weight="semibold" style={{ fontSize: 16 }}>{t("bodyWeight.title")}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 3 }}>{t("bodyWeight.trackerHint")}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text variant="micro" tone="muted">{t("bodyWeight.current")}</Text>
            <Text weight="semibold" style={{ fontFamily: fonts.dot, fontSize: 19, marginTop: 3 }}>{formatWeight(profile.data?.body_weight_kg, unit)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <TextInput
            editable={!saving && !logWeight.isPending}
            value={draft.bodyWeight}
            onChangeText={(bodyWeight) => {
              setWeightSaved(false);
              setWeightError(null);
              const clean = bodyWeight.replace(/[^\d.,]/g, "");
              const parsed = parseWeight(clean);
              patch((current) => ({
                ...current,
                bodyWeight: clean,
                bodyWeightUnit: unit,
                bodyWeightAuto: false,
                exercises: rebaseBodyweightExercises(current.exercises, parsed == null ? null : unitToKg(parsed, unit)),
              }));
            }}
            placeholder={t("bodyWeight.inputLabel", { unit })}
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            accessibilityLabel={t("bodyWeight.inputLabel", { unit })}
            style={[inputStyle, { flex: 1, marginBottom: 0 }]}
          />
          <Button variant="lime" size="md" loading={logWeight.isPending} disabled={saving} onPress={() => void recordBodyWeight()}>
            {t("bodyWeight.record")}
          </Button>
        </View>
        {weightSaved ? <Text variant="caption" tone="lime" style={{ marginTop: 10 }}>{t("bodyWeight.saved")}</Text> : null}
        {weightError ? <Text variant="caption" tone="pink" style={{ marginTop: 10 }}>{weightError}</Text> : null}
      </Card>
      {error ? <Text tone="pink" style={{ marginBottom: 10 }}>{error}</Text> : null}
      {draft.exercises.length > 0 ? (
        <Button variant="gradient" size="lg" block loading={saving} disabled={!cloudVerified || Boolean(pendingRemote) || logWeight.isPending} onPress={save}>
          {t("workout.save")}
        </Button>
      ) : null}
      {!draftIsEmpty(draft) ? <Button variant="ghost" block onPress={discard} style={{ marginTop: 10 }}>{t("workout.discard")}</Button> : null}

      <BottomSheet
        open={exercisePicker}
        onClose={closeExercisePicker}
        title={t(creatingExercise ? "picker.newTitle" : "picker.title")}
        closeLabel={t("common.close")}
      >
        {creatingExercise ? (
          <InlineExerciseCreate
            groups={groups.data ?? []}
            profileUnit={unit}
            defaultGroupId={pickerGroupId}
            onCreated={chooseExercise}
            onCancel={() => setCreatingExercise(false)}
          />
        ) : (
          <View>
            <TextInput
              editable={!saving}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder={t("picker.search")}
              placeholderTextColor={colors.faint}
              style={inputStyle}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 13 }}>
              <Chip selected={pickerGroupId === null} onPress={() => setPickerGroupId(null)}>{t("common.all")}</Chip>
              {(groups.data ?? []).map((group) => (
                <Chip key={group.id} selected={pickerGroupId === group.id} onPress={() => setPickerGroupId(group.id)}>
                  {group.name}
                </Chip>
              ))}
            </ScrollView>
            {exercises.isLoading || groups.isLoading ? <LoadingState /> : null}
            {exercises.error || groups.error ? (
              <View style={{ gap: 10, marginVertical: 12 }}>
                <Text tone="pink">{t("common.error")}</Text>
                <Button size="sm" onPress={() => { void exercises.refetch(); void groups.refetch(); }}>
                  {t("common.retry")}
                </Button>
              </View>
            ) : null}
            {!exercises.isLoading && !groups.isLoading && !exercises.error && !groups.error ? (
              <>
                {filteredExercises.map((exercise) => (
                  <Pressable key={exercise.id} onPress={() => chooseExercise(exercise)} style={pickerRow}>
                    <View style={{ flex: 1 }}>
                      <Text>{exercise.name}</Text>
                      <Text tone="muted" variant="caption" style={{ marginTop: 3 }}>
                        {groupName.get(exercise.muscle_group_id)} · {t(`equipment.${exercise.equipment}`)}
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={21} color={colors.lime} />
                  </Pressable>
                ))}
                {filteredExercises.length === 0 ? (
                  <Text tone="muted" style={{ paddingVertical: 16 }}>
                    {pickerSearch.trim()
                      ? t("picker.emptyFor", { query: pickerSearch.trim() })
                      : t("picker.empty")}
                  </Text>
                ) : null}
              </>
            ) : null}
            <Button
              variant="surface"
              block
              dashed
              leading={<Ionicons name="add" size={18} color={colors.lime} />}
              disabled={groups.isLoading || !groups.data?.length}
              onPress={() => setCreatingExercise(true)}
              style={{ marginTop: 18 }}
            >
              {t("picker.createNew")}
            </Button>
          </View>
        )}
      </BottomSheet>
      {Platform.OS === "ios" ? (
        <BottomSheet open={datePickerOpen} onClose={() => setDatePickerOpen(false)} title={t("workout.date")} closeLabel={t("common.close")}>
          <DateTimePicker
            value={pickerDate(draft.date)}
            mode="date"
            display="inline"
            themeVariant="dark"
            accentColor={colors.lime}
            onChange={(_event, selected) => {
              if (!selected) return;
              setWeightSaved(false);
              patch((current) => ({ ...current, date: localISO(selected) }));
            }}
          />
          <Button variant="surface" block onPress={() => setDatePickerOpen(false)} style={{ marginTop: 12 }}>{t("common.close")}</Button>
        </BottomSheet>
      ) : datePickerOpen ? (
        <DateTimePicker
          value={pickerDate(draft.date)}
          mode="date"
          display="default"
          onChange={(event, selected) => {
            setDatePickerOpen(false);
            if (event.type !== "set" || !selected) return;
            setWeightSaved(false);
            patch((current) => ({ ...current, date: localISO(selected) }));
          }}
        />
      ) : null}
      <BottomSheet
        open={copyModal != null}
        onClose={() => { setCopyModal(null); setCopySelectedDay(null); }}
        title={t(copyModal?.source ? "workout.copyModeTitle" : "workout.copyPickerTitle")}
        closeLabel={t("common.close")}
      >
        {copyModal?.source ? (
          <View style={{ gap: 12 }}>
            {copyModal.kind === "day" ? (
              <Pressable onPress={() => setCopyModal({ kind: "day", source: null })} style={{ alignSelf: "flex-start", flexDirection: "row", gap: 5, alignItems: "center", marginBottom: 3 }}>
                <Ionicons name="chevron-back" size={17} color={colors.muted} />
                <Text tone="muted" variant="caption">{t("workout.copyPickerTitle")}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => applyCopy("full")} style={copyOptionStyle} accessibilityRole="button">
              <View style={sourceIconStyle}><Ionicons name="time-outline" size={19} color={colors.lime} /></View>
              <View style={{ flex: 1 }}>
                <Text weight="semibold">{t("workout.copyModeFull")}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 3 }}>{t("workout.copyModeFullHint")}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => applyCopy("last-weight")} style={copyOptionStyle} accessibilityRole="button">
              <View style={sourceIconStyle}><Ionicons name="barbell-outline" size={19} color={colors.lime} /></View>
              <View style={{ flex: 1 }}>
                <Text weight="semibold">{t("workout.copyModeWeight")}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 3 }}>{t("workout.copyModeWeightHint")}</Text>
              </View>
            </Pressable>
          </View>
        ) : copyModal?.kind === "day" ? (
          <View style={{ gap: 13 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable onPress={() => shiftCopyMonth(-1)} style={calendarArrowStyle} accessibilityRole="button"><Ionicons name="chevron-back" size={19} color={colors.muted} /></Pressable>
              <Text weight="semibold">{copyFirst.toLocaleDateString(lang, { month: "long", year: "numeric" })}</Text>
              <Pressable onPress={() => shiftCopyMonth(1)} style={calendarArrowStyle} accessibilityRole="button"><Ionicons name="chevron-forward" size={19} color={colors.muted} /></Pressable>
            </View>
            <View style={{ flexDirection: "row" }}>
              {Array.from({ length: 7 }, (_, index) => (
                <Text key={index} variant="micro" tone="muted" style={{ flex: 1, textAlign: "center" }}>
                  {new Date(2024, 0, index + 1).toLocaleDateString(lang, { weekday: "narrow" })}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {copyCells.map((day, index) => {
                const iso = day >= 1 && day <= copyDays ? localISO(new Date(copyYear, copyMonthNumber - 1, day, 12)) : null;
                const marked = iso != null && copyMarkedDates.has(iso);
                return (
                  <View key={index} style={{ width: `${100 / 7}%`, padding: 2 }}>
                    <Pressable
                      disabled={!iso}
                      onPress={() => setCopySelectedDay(iso)}
                      accessibilityRole="button"
                      style={{ minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: iso && copySelectedDay === iso ? "rgba(215,246,81,0.13)" : "transparent", borderWidth: iso && copySelectedDay === iso ? 1 : 0, borderColor: "rgba(215,246,81,0.5)" }}
                    >
                      <Text tone={!iso ? "faint" : copySelectedDay === iso ? "lime" : "primary"}>{iso ? day : ""}</Text>
                      {marked ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.lime, marginTop: 1 }} /> : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
            {copySelectedDay == null ? <Text tone="muted" style={{ textAlign: "center", marginVertical: 8 }}>{t("workout.copyPickerHint")}</Text> : null}
            {copySelectedDay != null && copyDayWorkouts.length === 0 ? <Text tone="muted" style={{ textAlign: "center", marginVertical: 8 }}>{t("workout.copyPickerEmptyDay")}</Text> : null}
            {copyDayWorkouts.map((workout) => (
              <Pressable key={workout.id} onPress={() => setCopyModal({ kind: "day", source: workout })} style={sourceCardStyle} accessibilityRole="button">
                <View style={sourceIconStyle}><Ionicons name="calendar-outline" size={18} color={colors.lime} /></View>
                <View style={{ flex: 1 }}>
                  <Text weight="medium">{t("workout.copyThis", { type: workout.type })}</Text>
                  <Text variant="caption" tone="muted" style={{ marginTop: 3 }}>
                    {fromISO(workout.date).toLocaleDateString(lang, { month: "short", day: "numeric" })} · {translateCount(lang, "count.exercises", workout.workout_exercises.length)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </BottomSheet>
      <BottomSheet
        open={templatePicker}
        onClose={() => {
          pendingTemplateCreate.current = false;
          setTemplatePicker(false);
        }}
        onClosed={() => {
          if (!pendingTemplateCreate.current) return;
          pendingTemplateCreate.current = false;
          // iOS cannot present Library's create sheet while this native modal is dismissing.
          router.push({ pathname: "/library", params: { tab: "templates", create: "1" } });
        }}
        title={t("workout.templatePickerTitle")}
        closeLabel={t("common.close")}
      >
        {templates.isLoading ? <LoadingState /> : null}
        {templates.error ? <Text tone="pink">{t("common.error")}</Text> : null}
        {!templates.isLoading && !templates.error && !templates.data?.length ? (
          <View style={{ alignItems: "center", gap: 8, paddingVertical: 18 }}>
            <Text weight="semibold">{t("templates.emptyTitle")}</Text>
            <Text tone="muted" style={{ textAlign: "center" }}>{t("templates.emptyHint")}</Text>
            <Button variant="lime" size="sm" style={{ marginTop: 7 }} onPress={() => {
              pendingTemplateCreate.current = true;
              setTemplatePicker(false);
            }} leading={<Ionicons name="add" size={17} color={colors.black} />}>{t("templates.new")}</Button>
          </View>
        ) : null}
        {(templates.data ?? []).map((template) => (
          <Pressable key={template.id} disabled={template.exerciseCount === 0} onPress={() => {
            const perform = () => void applyTemplate(template.id).catch((failure) => setError(userErrorMessage(t, failure)));
            if (draftIsEmpty(draft)) perform();
            else requestReplace(perform, true);
          }} style={[copyOptionStyle, template.exerciseCount === 0 ? { opacity: 0.6 } : null]}>
            <View style={sourceIconStyle}><WorkoutGlyph name="template" size={18} color={colors.lime} /></View>
            <View style={{ flex: 1 }}>
              <Text weight="semibold">{template.name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, backgroundColor: colors.raised, paddingHorizontal: 8, paddingVertical: 3 }}><Text variant="caption" tone="muted">{template.type}</Text></View>
                <Text tone="muted" variant="caption">{translateCount(lang, "count.exercises", template.exerciseCount)}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.faint} />
          </Pressable>
        ))}
      </BottomSheet>
      <BottomSheet
        open={Boolean(exerciseTool && toolExercise)}
        onClose={closeExerciseTool}
        title={t(exerciseTool?.kind === "machine" ? "machine.title" : "compare.title")}
        closeLabel={t("common.close")}
      >
        {toolExercise ? (
          exerciseTool?.kind === "machine" ? (
            <View style={{ gap: 13 }}>
              <Text variant="caption" tone="muted">{toolExercise.name}</Text>
              {machineEditing ? (
                <>
                  <TextInput
                    value={machineText}
                    onChangeText={setMachineText}
                    placeholder={t("machine.placeholder")}
                    placeholderTextColor={colors.faint}
                    multiline
                    style={[inputStyle, { minHeight: 116, marginBottom: 0, textAlignVertical: "top", paddingTop: 13 }]}
                  />
                  {machineError ? <Text tone="pink">{machineError}</Text> : null}
                  <View style={{ flexDirection: "row", gap: 9 }}>
                    <Button variant="surface" style={{ flex: 1 }} disabled={updateMachine.isPending} onPress={() => { setMachineEditing(false); setMachineText(liveMachineSettings ?? ""); }}>{t("common.cancel")}</Button>
                    <Button variant="lime" style={{ flex: 1 }} loading={updateMachine.isPending} onPress={() => void saveMachine()}>{t("common.save")}</Button>
                  </View>
                </>
              ) : (
                <>
                  <Card radius={18} padding={17}>
                    <Text tone="muted">{liveMachineSettings?.trim() || t("machine.empty")}</Text>
                  </Card>
                  <Button variant="surface" block onPress={() => setMachineEditing(true)}>{t(liveMachineSettings ? "machine.edit" : "machine.add")}</Button>
                </>
              )}
            </View>
          ) : (
            <View style={{ gap: 13 }}>
              <Text variant="caption" tone="muted">{toolExercise.name}</Text>
              {history.isLoading ? <LoadingState /> : history.error ? <Text tone="pink">{t("common.error")}</Text> : null}
              {!history.isLoading && !history.error && compareDates.length === 0 ? (
                <View style={{ alignItems: "center", gap: 7, paddingVertical: 28 }}>
                  <Text weight="semibold">{t("compare.emptyTitle")}</Text>
                  <Text tone="muted" variant="caption" style={{ textAlign: "center" }}>{t("compare.emptyHint")}</Text>
                </View>
              ) : !history.isLoading && !history.error ? (
              <>
              {toolExercise.sets.some((set) => set.weight.trim() || set.addedWeight?.trim() || set.reps.trim()) ? (
              <>
              <Text variant="micro" tone="muted">{t("compare.thisSession")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {toolExercise.sets.filter((set) => set.weight.trim() || set.addedWeight?.trim() || set.reps.trim()).map((set) => {
                  const total = parseWeight(set.weight);
                  return <WorkoutCompareChip key={set.key} weight={set.weight || "—"} reps={set.reps || "—"} unit={toolExercise.unit} warmup={set.warmup} toFailure={set.toFailure} bodyWeightKg={toolExercise.equipment === "bodyweight" ? draftBodyWeightKg(draft, unit) : undefined} totalWeightKg={total == null ? null : unitToKg(total, toolExercise.unit)} />;
                })}
              </View>
              </>
              ) : null}
              {compareDates.length ? (
                <>
                  <Pressable
                    onPress={() => {
                      if (!compareCalendarOpen && activeCompareDay) setCompareMonth(activeCompareDay.slice(0, 7));
                      setCompareCalendarOpen((open) => !open);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={activeCompareDay ?? t("compare.pickDay")}
                    style={compareDateRowStyle}
                  >
                    <Ionicons name="calendar-outline" size={18} color={colors.lime} />
                    <Text style={{ flex: 1 }}>{activeCompareDay ? pickerDate(activeCompareDay).toLocaleDateString(lang, { dateStyle: "long" }) : t("compare.pickDay")}</Text>
                    <Ionicons name={compareCalendarOpen ? "chevron-up" : "chevron-down"} size={17} color={colors.muted} />
                  </Pressable>
                  {compareCalendarOpen ? (
                    <View style={compareCalendarStyle}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                        <Pressable onPress={() => shiftCompareMonth(-1)} disabled={compareMonth <= (compareDates.at(-1)?.slice(0, 7) ?? compareMonth)} accessibilityRole="button" accessibilityLabel={t("history.previous")} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center", opacity: compareMonth <= (compareDates.at(-1)?.slice(0, 7) ?? compareMonth) ? 0.3 : 1 }}>
                          <Ionicons name="chevron-back" size={18} color={colors.text} />
                        </Pressable>
                        <Text weight="semibold">{compareMonthDate.toLocaleDateString(lang, { month: "long", year: "numeric" })}</Text>
                        <Pressable onPress={() => shiftCompareMonth(1)} disabled={compareMonth >= (compareDates[0]?.slice(0, 7) ?? compareMonth)} accessibilityRole="button" accessibilityLabel={t("history.next")} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center", opacity: compareMonth >= (compareDates[0]?.slice(0, 7) ?? compareMonth) ? 0.3 : 1 }}>
                          <Ionicons name="chevron-forward" size={18} color={colors.text} />
                        </Pressable>
                      </View>
                      <View style={{ flexDirection: "row" }}>
                        {Array.from({ length: 7 }, (_, index) => (
                          <Text key={index} variant="micro" tone="faint" style={{ width: "14.2857%", textAlign: "center", marginBottom: 5 }}>
                            {new Date(2024, 0, index + 1).toLocaleDateString(lang, { weekday: "short" }).toUpperCase()}
                          </Text>
                        ))}
                      </View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {calendarCells.map((day, index) => {
                          const date = new Date(compareYear, compareMonthNumber - 1, day, 12);
                          const iso = localISO(date);
                          const inMonth = date.getMonth() === compareMonthNumber - 1;
                          const available = inMonth && availableCompareDates.has(iso);
                          const selected = iso === activeCompareDay;
                          return (
                            <View key={index} style={{ width: "14.2857%", height: 45, alignItems: "center", justifyContent: "center" }}>
                              <Pressable onPress={() => { setCompareDay(iso); setCompareCalendarOpen(false); }} disabled={!available} accessibilityRole="button" accessibilityLabel={date.toLocaleDateString(lang, { dateStyle: "full" })} accessibilityState={{ selected, disabled: !available }} style={{ width: 39, height: 39, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.lime : "transparent" }}>
                                <Text variant="caption" style={{ color: selected ? colors.black : available ? colors.text : colors.faint, opacity: !inMonth ? 0.42 : 1 }}>{date.getDate()}</Text>
                                {available ? <View style={{ position: "absolute", bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: selected ? colors.black : colors.lime }} /> : null}
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}
              {selectedHistory.length ? (
                <View style={{ gap: 10 }}>
                  <Text variant="micro" tone="muted">{activeCompareDay ? pickerDate(activeCompareDay).toLocaleDateString(lang, { dateStyle: "long" }) : t("compare.selectedDay")}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {selectedHistory.flatMap(({ workout, entry }) => entry.sets.map((set) => (
                      <WorkoutCompareChip key={set.id} weight={set.weight_kg == null ? "—" : String(roundWeight(kgToUnit(set.weight_kg, toolExercise.unit)))} reps={set.reps == null ? "—" : String(set.reps)} unit={toolExercise.unit} warmup={set.set_type === "warmup"} toFailure={set.to_failure} bodyWeightKg={toolExercise.equipment === "bodyweight" ? workout.body_weight_kg : undefined} totalWeightKg={set.weight_kg} />
                    )))}
                  </View>
                  {selectedHistory.map(({ entry }) => entry.notes ? <Text key={entry.id} tone="muted" style={{ marginTop: 8 }}>{entry.notes}</Text> : null)}
                </View>
              ) : <Text tone="muted">{t("compare.noSets")}</Text>}
              </>
              ) : null}
            </View>
          )
        ) : null}
      </BottomSheet>
      <WorkoutPlateSheet context={plateContext} onClose={() => setPlateContext(null)} />
      <WorkoutConfirmSheet
        open={confirmReplaceOpen}
        title={t("workout.templateReplaceTitle")}
        message={t("workout.templateReplaceMessage")}
        confirmLabel={t("workout.templateReplaceConfirm")}
        onClose={closeReplace}
        onConfirm={() => {
          const action = pendingReplaceRef.current;
          closeReplace();
          action?.();
        }}
      />
      <WorkoutConfirmSheet
        open={confirmDiscardOpen}
        title={t("workout.discardTitle")}
        message={t("workout.discardMessage")}
        confirmLabel={t("workout.discard")}
        onClose={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          if (user && !saveInFlight.current) reset(user.id);
        }}
      />
      <BottomSheet open={Boolean(pendingRemote && user && pendingRemote.ownerId === user.id)} onClose={() => router.back()} title={t("workout.draftConflictTitle")} closeLabel={t("common.close")}>
        <Text tone="muted" style={{ marginBottom: 20 }}>{t("workout.draftConflictMessage")}</Text>
        <Button variant="lime" block onPress={() => user && resolveConflict(user.id, false)}>{t("workout.draftKeepDevice")}</Button>
        <Button variant="surface" block style={{ marginTop: 10 }} onPress={() => user && resolveConflict(user.id, true)}>{t("workout.draftKeepCloud")}</Button>
      </BottomSheet>
    </Screen>
  );
}

const inputStyle = {
  backgroundColor: colors.raised,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: radii.medium,
  paddingHorizontal: 14,
  minHeight: 48,
  color: colors.text,
  fontFamily: fonts.regular,
  fontSize: 15,
  marginBottom: 15,
};

const pickerRow = {
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: colors.line,
  flexDirection: "row" as const,
  gap: 10,
};

const iconAction = {
  width: 34,
  height: 36,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  borderRadius: 18,
  backgroundColor: colors.raised,
};

const dateButtonStyle = {
  minHeight: 48,
  borderRadius: radii.medium,
  backgroundColor: colors.raised,
  borderWidth: 1,
  borderColor: colors.line,
  paddingHorizontal: 14,
  marginBottom: 15,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
};

const sourceCardStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  paddingHorizontal: 15,
  paddingVertical: 14,
  borderRadius: radii.card,
  borderWidth: 1,
  borderStyle: "dashed" as const,
  borderColor: colors.line,
  backgroundColor: "rgba(30,30,35,0.48)",
};

const sourceIconStyle = {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: colors.raised,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const copyOptionStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  paddingHorizontal: 15,
  paddingVertical: 15,
  borderRadius: radii.card,
  borderWidth: 1,
  borderColor: colors.line,
  backgroundColor: "rgba(30,30,35,0.65)",
};

const calendarArrowStyle = {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  backgroundColor: colors.raised,
};

const compareDateRowStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
  paddingHorizontal: 14,
  minHeight: 48,
  borderRadius: radii.medium,
  borderWidth: 1,
  borderColor: colors.line,
  backgroundColor: colors.raised,
};

const compareCalendarStyle = {
  backgroundColor: colors.raised,
  borderRadius: radii.medium,
  borderWidth: 1,
  borderColor: colors.line,
  padding: 12,
};
