"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import {
  normalizeTrainingSchedule,
  scheduleForStorage,
  useProfile,
  useUpdateProfile,
  type Profile,
  type TrainingSchedule,
} from "@/entities/user";
import { SignOutButton } from "@/features/auth";
import { AvatarPresetGrid } from "@/features/avatar";
import {
  hasIncompleteTrainingDays,
  TRAINING_WEEK_PRESETS,
  TrainingWeekEditor,
} from "@/features/training-schedule";
import {
  DEFAULT_BAR_KG,
  DEFAULT_BAR_LB,
  DEFAULT_PLATES_KG,
  DEFAULT_PLATES_LB,
} from "@/shared/config/workout";
import {
  CURRENT_ONBOARDING_VERSION,
  CURRENT_RELEASE,
} from "@/shared/config/releases";
import { LANGUAGE_OPTIONS, isLang, useI18n, type Lang } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import {
  kgToUnit,
  parseWeight,
  roundWeight,
  unitToKg,
  type Unit,
} from "@/shared/lib/weight";
import {
  Avatar,
  BrandMark,
  Button,
  Card,
  ErrorNote,
  Field,
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconClose,
  IconCompare,
  IconDumbbell,
  IconHistory,
  IconPlates,
  IconSettings,
  Input,
  PageLoader,
  Segmented,
} from "@/shared/ui";

const TOTAL_STEPS = 5;
const SESSION_KEY_PREFIX = "deepgym-onboarding-v1:";

type ScheduleMode = "unset" | "fixed" | "flexible";

interface RouteMode {
  ready: boolean;
  replay: boolean;
  preview: boolean;
  next: string;
}

interface StoredDraft {
  step: number;
  name: string;
  language: Lang;
  unit: Unit;
  barWeight: string;
  scheduleMode: ScheduleMode;
  schedule: TrainingSchedule;
  avatarUrl: string | null;
}

export function OnboardingView() {
  const router = useRouter();
  const { data: profile, isLoading } = useProfile();
  const [mode, setMode] = useState<RouteMode>({
    ready: false,
    replay: false,
    preview: false,
    next: "/",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedNext = params.get("next");
    setMode({
      ready: true,
      replay: params.get("replay") === "1",
      preview:
        process.env.NODE_ENV !== "production" &&
        params.get("preview") === "1",
      next: safeLocalPath(requestedNext),
    });
  }, []);

  const alreadyComplete =
    (profile?.onboarding_version ?? 0) >= CURRENT_ONBOARDING_VERSION;
  useEffect(() => {
    if (!mode.ready || !profile) return;
    if (alreadyComplete && !mode.replay && !mode.preview) {
      router.replace("/");
    }
  }, [alreadyComplete, mode, profile, router]);

  if (
    isLoading ||
    !profile ||
    !mode.ready ||
    (alreadyComplete && !mode.replay && !mode.preview)
  ) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <PageLoader />
      </div>
    );
  }

  return <OnboardingWizard key={profile.id} profile={profile} mode={mode} />;
}

function OnboardingWizard({
  profile,
  mode,
}: {
  profile: Profile;
  mode: RouteMode;
}) {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const updateProfile = useUpdateProfile();
  const storageKey = `${SESSION_KEY_PREFIX}${profile.id}`;
  const persistedLanguageRef = useRef<Lang>(profile.language ?? lang);
  const languageCommittedRef = useRef(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.display_name ?? "");
  const [language, setLanguage] = useState<Lang>(profile.language ?? lang);
  const [unit, setUnit] = useState<Unit>(profile.unit ?? "kg");
  const [barWeight, setBarWeight] = useState(() =>
    String(roundWeight(kgToUnit(profile.bar_weight_kg, profile.unit))),
  );
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(
    profile.training_schedule ? "fixed" : "unset",
  );
  const [schedule, setSchedule] = useState<TrainingSchedule>(() =>
    normalizeTrainingSchedule(profile.training_schedule),
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile.avatar_url,
  );
  const [stepError, setStepError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  const plateValues = useMemo(() => {
    if (unit === "kg") {
      return profile.unit === "kg" && profile.plates_kg.length > 0
        ? profile.plates_kg
        : DEFAULT_PLATES_KG;
    }
    return profile.unit === "lb" && profile.plates_lb.length > 0
      ? profile.plates_lb
      : DEFAULT_PLATES_LB;
  }, [profile, unit]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<StoredDraft>;
        if (typeof stored.step === "number") {
          setStep(Math.min(TOTAL_STEPS - 1, Math.max(0, stored.step)));
        }
        if (typeof stored.name === "string") setName(stored.name);
        if (isLang(stored.language)) {
          setLanguage(stored.language);
          setLang(stored.language);
        }
        if (stored.unit === "kg" || stored.unit === "lb") {
          setUnit(stored.unit);
        }
        if (typeof stored.barWeight === "string") {
          setBarWeight(stored.barWeight);
        }
        if (
          stored.scheduleMode === "unset" ||
          stored.scheduleMode === "fixed" ||
          stored.scheduleMode === "flexible"
        ) {
          setScheduleMode(stored.scheduleMode);
        }
        if (stored.schedule) {
          setSchedule(normalizeTrainingSchedule(stored.schedule));
        }
        if (stored.avatarUrl === null || typeof stored.avatarUrl === "string") {
          setAvatarUrl(stored.avatarUrl);
        }
      }
    } catch {
      // A malformed/private session store should never block onboarding.
    }
    setDraftReady(true);
  }, [setLang, storageKey]);

  useEffect(() => {
    if (!draftReady) return;
    const draft: StoredDraft = {
      step,
      name,
      language,
      unit,
      barWeight,
      scheduleMode,
      schedule,
      avatarUrl,
    };
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // Session persistence is a convenience; the live draft remains usable.
    }
  }, [
    barWeight,
    avatarUrl,
    draftReady,
    language,
    name,
    schedule,
    scheduleMode,
    step,
    storageKey,
    unit,
  ]);

  useEffect(() => {
    return () => {
      if (!languageCommittedRef.current) {
        setLang(persistedLanguageRef.current);
      }
    };
  }, [setLang]);

  useEffect(() => {
    if (!draftReady) return;
    const frame = requestAnimationFrame(() => {
      stepHeadingRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [draftReady, step]);

  if (!draftReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <PageLoader />
      </div>
    );
  }

  function changeLanguage(next: Lang) {
    setLanguage(next);
    setLang(next);
    setStepError(null);
  }

  function changeUnit(next: Unit) {
    setUnit(next);
    setBarWeight(String(next === "kg" ? DEFAULT_BAR_KG : DEFAULT_BAR_LB));
    setStepError(null);
  }

  function selectAvatar(next: string | null) {
    if (next === avatarUrl) return;
    setAvatarUrl(next);
  }

  function chooseScheduleMode(next: Exclude<ScheduleMode, "unset">) {
    setScheduleMode(next);
    setStepError(null);
    if (next === "fixed" && !schedule.some(Boolean)) {
      const recommended = TRAINING_WEEK_PRESETS.find(
        (preset) => preset.id === "threeDays",
      );
      if (recommended) setSchedule([...recommended.value] as TrainingSchedule);
    }
  }

  function continueFlow() {
    const error = validateStep(step, {
      name,
      barWeight,
      scheduleMode,
      schedule,
      t,
    });
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(null);
    setStep((current) => Math.min(TOTAL_STEPS - 1, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStepError(null);
    setStep((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exitReplay() {
    clearStoredDraft(storageKey);
    setLang(persistedLanguageRef.current);
    router.back();
  }

  async function finish(destination: string) {
    const parsedBar = parseWeight(barWeight);
    if (parsedBar == null || parsedBar <= 0) {
      setStep(2);
      setStepError(t("onboarding.equipment.invalidBar"));
      return;
    }

    setSaveError(null);
    if (mode.preview) {
      clearStoredDraft(storageKey);
      setLang(persistedLanguageRef.current);
      router.replace(destination);
      return;
    }

    const unitChanged = unit !== profile.unit;
    const patch: Partial<Omit<Profile, "id" | "created_at">> = {
      display_name: name.trim(),
      language,
      unit,
      avatar_url: avatarUrl,
      bar_weight_kg: Math.round(unitToKg(parsedBar, unit) * 1000) / 1000,
      plates_kg:
        unit === "kg" && (unitChanged || profile.plates_kg.length === 0)
          ? [...DEFAULT_PLATES_KG]
          : profile.plates_kg,
      plates_lb:
        unit === "lb" && (unitChanged || profile.plates_lb.length === 0)
          ? [...DEFAULT_PLATES_LB]
          : profile.plates_lb,
      training_schedule:
        scheduleMode === "fixed" ? scheduleForStorage(schedule) : null,
    };

    // These fields may not exist yet during a staggered code/schema rollout.
    // Normal profile settings can still be saved atomically without them.
    if (typeof profile.onboarding_version === "number") {
      patch.onboarding_version = CURRENT_ONBOARDING_VERSION;
      if ("onboarding_completed_at" in profile) {
        patch.onboarding_completed_at = new Date().toISOString();
      }
    }
    if (typeof profile.last_seen_release_version === "number") {
      patch.last_seen_release_version = CURRENT_RELEASE.sequence;
    }

    try {
      await updateProfile.mutateAsync(patch);
      languageCommittedRef.current = true;
      clearStoredDraft(storageKey);
      router.replace(destination);
    } catch {
      setSaveError(t("onboarding.saveError"));
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-white/[0.035] bg-bg/88 px-5 pt-4 pb-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <BrandMark width={28} />
          <p
            aria-live="polite"
            className="text-xs font-semibold tracking-[0.12em] text-muted uppercase"
          >
            {t("onboarding.progress", {
              current: step + 1,
              total: TOTAL_STEPS,
            })}
          </p>
          {mode.replay || mode.preview ? (
            <button
              type="button"
              onClick={exitReplay}
              aria-label={t("onboarding.exitGuide")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-raised text-muted"
            >
              <IconClose size={18} />
            </button>
          ) : (
            <span className="h-11 w-11" aria-hidden="true" />
          )}
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5" aria-hidden="true">
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-1 rounded-full transition-colors",
                index <= step ? "bg-lime" : "bg-line",
              )}
            />
          ))}
        </div>
      </header>

      <main className="flex-1 px-5 pt-7 pb-8">
        <div key={step} className="animate-fade-in">
          {step === 0 && <WelcomeStep t={t} headingRef={stepHeadingRef} />}
          {step === 1 && (
            <ProfileStep
              t={t}
              headingRef={stepHeadingRef}
              name={name}
              onNameChange={(value) => {
                setName(value);
                setStepError(null);
              }}
              language={language}
              onLanguageChange={changeLanguage}
              unit={unit}
              onUnitChange={changeUnit}
              avatarUrl={avatarUrl}
              onAvatarSelect={selectAvatar}
            />
          )}
          {step === 2 && (
            <EquipmentStep
              t={t}
              headingRef={stepHeadingRef}
              unit={unit}
              barWeight={barWeight}
              plateValues={plateValues}
              onBarWeightChange={(value) => {
                setBarWeight(value);
                setStepError(null);
              }}
            />
          )}
          {step === 3 && (
            <ScheduleStep
              t={t}
              headingRef={stepHeadingRef}
              mode={scheduleMode}
              onModeChange={chooseScheduleMode}
              schedule={schedule}
              onScheduleChange={(value) => {
                setSchedule(value);
                setStepError(null);
              }}
            />
          )}
          {step === 4 && (
            <TourStep
              t={t}
              headingRef={stepHeadingRef}
              name={name}
              avatarUrl={avatarUrl}
            />
          )}

          {stepError && <ErrorNote message={stepError} />}
          {saveError && <ErrorNote message={saveError} />}
        </div>
      </main>

      <footer className="sticky bottom-0 z-20 border-t border-white/[0.045] bg-bg/92 px-5 pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
        {step === 0 ? (
          <div className="space-y-1">
            <Button
              type="button"
              variant="lime"
              size="lg"
              className="w-full"
              onClick={continueFlow}
            >
              {t("onboarding.welcome.start")}
            </Button>
            {!mode.replay && !mode.preview && <SignOutButton compact />}
          </div>
        ) : step < TOTAL_STEPS - 1 ? (
          <div className="flex gap-3">
            <Button
              type="button"
              variant="surface"
              size="lg"
              aria-label={t("common.back")}
              className="w-14 shrink-0 px-0"
              onClick={goBack}
            >
              <IconChevronLeft size={20} />
            </Button>
            <Button
              type="button"
              variant="lime"
              size="lg"
              className="flex-1"
              onClick={continueFlow}
            >
              {t("onboarding.continue")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              type="button"
              variant="lime"
              size="lg"
              className="w-full"
              loading={updateProfile.isPending}
              onClick={() =>
                finish(mode.replay ? "/workouts/new" : "/workouts/new?first=1")
              }
            >
              {mode.replay
                ? t("onboarding.startWorkout")
                : t("onboarding.startFirstWorkout")}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="w-14 shrink-0 px-0"
                aria-label={t("common.back")}
                onClick={goBack}
              >
                <IconChevronLeft size={19} />
              </Button>
              <Button
                type="button"
                variant="surface"
                className="flex-1"
                loading={updateProfile.isPending}
                onClick={() => finish(mode.next)}
              >
                {t("onboarding.continueToApp")}
              </Button>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}

function WelcomeStep({ t, headingRef }: StepProps) {
  const features = [
    {
      icon: IconDumbbell,
      title: "onboarding.welcome.log.title",
      body: "onboarding.welcome.log.body",
    },
    {
      icon: IconSettings,
      title: "onboarding.welcome.remember.title",
      body: "onboarding.welcome.remember.body",
    },
    {
      icon: IconHistory,
      title: "onboarding.welcome.progress.title",
      body: "onboarding.welcome.progress.body",
    },
  ] as const;

  return (
    <div className="space-y-5">
      <Card variant="pink" className="dots-bg min-h-72 p-6">
        <BrandMark width={42} />
        <div className="mt-20">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-white/58 uppercase">
            {t("onboarding.welcome.eyebrow")}
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-2 text-[2rem] leading-[1.05] font-semibold"
          >
            {t("onboarding.welcome.title")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/68">
            {t("onboarding.welcome.body")}
          </p>
        </div>
      </Card>
      <div className="space-y-3">
        {features.map((feature, index) => (
          <FeatureRow
            key={feature.title}
            number={index + 1}
            icon={feature.icon}
            title={t(feature.title)}
            body={t(feature.body)}
          />
        ))}
      </div>
    </div>
  );
}

interface StepProps {
  t: ReturnType<typeof useI18n>["t"];
  headingRef: Ref<HTMLHeadingElement>;
}

function ProfileStep({
  t,
  headingRef,
  name,
  onNameChange,
  language,
  onLanguageChange,
  unit,
  onUnitChange,
  avatarUrl,
  onAvatarSelect,
}: StepProps & {
  name: string;
  onNameChange: (value: string) => void;
  language: Lang;
  onLanguageChange: (value: Lang) => void;
  unit: Unit;
  onUnitChange: (value: Unit) => void;
  avatarUrl: string | null;
  onAvatarSelect: (value: string | null) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        headingRef={headingRef}
        eyebrow={t("onboarding.profile.eyebrow")}
        title={t("onboarding.profile.title")}
        body={t("onboarding.profile.body")}
      />

      <Card variant="surface" className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Avatar src={avatarUrl} size={64} alt={name} />
          <div>
            <p className="text-sm font-semibold">{t("settings.chooseAvatar")}</p>
            <p className="mt-0.5 text-xs text-faint">
              {t("onboarding.profile.avatarOptional")}
            </p>
          </div>
        </div>
        <AvatarPresetGrid
          value={avatarUrl}
          onSelect={onAvatarSelect}
          size={48}
        />
      </Card>

      <Field label={t("settings.displayName")}>
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          autoComplete="name"
          placeholder={t("settings.yourName")}
        />
      </Field>

      <div>
        <p className="mb-2 text-[13px] font-medium text-muted">
          {t("settings.language")}
        </p>
        <Segmented
          value={language}
          onChange={onLanguageChange}
          options={LANGUAGE_OPTIONS}
          ariaLabel={t("settings.language")}
        />
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-muted">
          {t("settings.weightUnit")}
        </p>
        <Segmented
          value={unit}
          onChange={onUnitChange}
          ariaLabel={t("settings.weightUnit")}
          options={[
            { value: "kg", label: t("settings.kilograms") },
            { value: "lb", label: t("settings.pounds") },
          ]}
        />
      </div>
    </div>
  );
}

function EquipmentStep({
  t,
  headingRef,
  unit,
  barWeight,
  plateValues,
  onBarWeightChange,
}: StepProps & {
  unit: Unit;
  barWeight: string;
  plateValues: readonly number[];
  onBarWeightChange: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        headingRef={headingRef}
        eyebrow={t("onboarding.equipment.eyebrow")}
        title={t("onboarding.equipment.title")}
        body={t("onboarding.equipment.body")}
      />

      <Card variant="indigo" className="dots-bg p-5">
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white">
            <IconPlates size={21} />
          </span>
          <span className="rounded-full border border-white/12 bg-black/15 px-3 py-1 text-xs font-semibold text-white/70 uppercase">
            {unit}
          </span>
        </div>
        <p className="mt-8 text-lg font-semibold">
          {unit === "kg"
            ? t("onboarding.equipment.standardKg")
            : t("onboarding.equipment.standardLb")}
        </p>
        <p className="mt-1 text-sm text-white/62">
          {t("onboarding.equipment.plateCount", {
            count: plateValues.length,
          })}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {plateValues.map((plate) => (
            <span
              key={plate}
              className="rounded-full border border-white/12 bg-black/18 px-3 py-1.5 font-dot text-sm text-white/78"
            >
              {plate}
            </span>
          ))}
        </div>
      </Card>

      <Card variant="surface" className="space-y-3 p-4">
        <Field label={t("settings.barWeight", { unit })}>
          <div className="relative max-w-44">
            <Input
              value={barWeight}
              onChange={(event) =>
                onBarWeightChange(event.target.value.replace(/[^\d.,]/g, ""))
              }
              inputMode="decimal"
              className="pr-12 font-dot text-lg"
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-semibold text-muted uppercase">
              {unit}
            </span>
          </div>
        </Field>
        <p className="text-xs leading-relaxed text-muted">
          {t("onboarding.equipment.adjustLater")}
        </p>
      </Card>
    </div>
  );
}

function ScheduleStep({
  t,
  headingRef,
  mode,
  onModeChange,
  schedule,
  onScheduleChange,
}: StepProps & {
  mode: ScheduleMode;
  onModeChange: (mode: Exclude<ScheduleMode, "unset">) => void;
  schedule: TrainingSchedule;
  onScheduleChange: (value: TrainingSchedule) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        headingRef={headingRef}
        eyebrow={t("onboarding.schedule.eyebrow")}
        title={t("onboarding.schedule.title")}
        body={t("onboarding.schedule.body")}
      />

      <div className="grid grid-cols-2 gap-3">
        <ModeButton
          selected={mode === "fixed"}
          onClick={() => onModeChange("fixed")}
          icon={IconCalendar}
          label={t("onboarding.schedule.fixed")}
        />
        <ModeButton
          selected={mode === "flexible"}
          onClick={() => onModeChange("flexible")}
          icon={IconDumbbell}
          label={t("onboarding.schedule.flexible")}
        />
      </div>

      {mode === "fixed" && (
        <TrainingWeekEditor
          value={schedule}
          onChange={onScheduleChange}
          quickPresets={TRAINING_WEEK_PRESETS}
          presetLabels={{
            twoDays: t("onboarding.schedule.twoDays"),
            threeDays: t("onboarding.schedule.threeDays"),
            fourDays: t("onboarding.schedule.fourDays"),
          }}
          ariaLabel={t("settings.trainingWeek")}
        />
      )}

      {mode === "flexible" && (
        <Card variant="indigo" className="dots-bg p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/8">
            <IconCheck size={19} />
          </span>
          <p className="mt-8 text-lg font-semibold">
            {t("onboarding.schedule.flexible")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/65">
            {t("onboarding.schedule.flexibleHint")}
          </p>
        </Card>
      )}
    </div>
  );
}

function TourStep({
  t,
  headingRef,
  name,
  avatarUrl,
}: StepProps & { name: string; avatarUrl: string | null }) {
  const items = [
    {
      icon: IconDumbbell,
      title: "onboarding.tour.workout.title",
      body: "onboarding.tour.workout.body",
    },
    {
      icon: IconPlates,
      title: "onboarding.tour.equipment.title",
      body: "onboarding.tour.equipment.body",
    },
    {
      icon: IconHistory,
      title: "onboarding.tour.history.title",
      body: "onboarding.tour.history.body",
    },
    {
      icon: IconCompare,
      title: "onboarding.tour.progress.title",
      body: "onboarding.tour.progress.body",
    },
  ] as const;

  return (
    <div className="space-y-5">
      <Card variant="cherry" className="dots-bg p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.15em] text-white/55 uppercase">
              {t("onboarding.tour.eyebrow")}
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 text-2xl leading-tight font-semibold"
            >
              {t("onboarding.tour.title")}
            </h1>
          </div>
          <Avatar src={avatarUrl} size={62} alt={name} />
        </div>
        <p className="mt-5 text-sm leading-relaxed text-white/66">
          {t("onboarding.tour.body")}
        </p>
      </Card>

      <div className="space-y-3">
        {items.map((item, index) => (
          <FeatureRow
            key={item.title}
            number={index + 1}
            icon={item.icon}
            title={t(item.title)}
            body={t(item.body)}
          />
        ))}
      </div>
    </div>
  );
}

function StepHeader({
  headingRef,
  eyebrow,
  title,
  body,
}: {
  headingRef: Ref<HTMLHeadingElement>;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-[0.16em] text-lime uppercase">
        {eyebrow}
      </p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-[1.8rem] leading-[1.08] font-semibold"
      >
        {title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function FeatureRow({
  number,
  icon: Icon,
  title,
  body,
}: {
  number: number;
  icon: typeof IconDumbbell;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-card border border-line/70 bg-surface/78 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-lime/18 bg-lime/8 text-lime">
        <Icon size={19} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-dot text-xs text-faint">
            {String(number).padStart(2, "0")}
          </span>
          <p className="font-semibold">{title}</p>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}

function ModeButton({
  selected,
  onClick,
  icon: Icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: typeof IconDumbbell;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative flex min-h-32 flex-col items-start justify-between rounded-card border p-4 text-left transition-colors",
        selected
          ? "border-lime/40 bg-lime/[0.07] text-text"
          : "border-line bg-surface/72 text-muted",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border",
          selected
            ? "border-lime/25 bg-lime/12 text-lime"
            : "border-line bg-raised text-faint",
        )}
      >
        <Icon size={18} />
      </span>
      <span className="mt-4 text-sm leading-tight font-semibold">{label}</span>
      {selected && (
        <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-lime text-black">
          <IconCheck size={14} />
        </span>
      )}
    </button>
  );
}

function validateStep(
  step: number,
  values: {
    name: string;
    barWeight: string;
    scheduleMode: ScheduleMode;
    schedule: TrainingSchedule;
    t: ReturnType<typeof useI18n>["t"];
  },
): string | null {
  if (step === 1 && !values.name.trim()) {
    return values.t("onboarding.profile.nameRequired");
  }
  if (step === 2) {
    const bar = parseWeight(values.barWeight);
    if (bar == null || bar <= 0) {
      return values.t("onboarding.equipment.invalidBar");
    }
  }
  if (step === 3) {
    if (values.scheduleMode === "unset") {
      return values.t("onboarding.schedule.required");
    }
    if (
      values.scheduleMode === "fixed" &&
      (!values.schedule.some(Boolean) ||
        hasIncompleteTrainingDays(values.schedule))
    ) {
      return values.t("settings.chooseTypeForEnabled");
    }
  }
  return null;
}

function safeLocalPath(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

function clearStoredDraft(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing else to clean up.
  }
}
