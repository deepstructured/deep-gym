import { PRESET_AVATARS } from "@deepgym/core/avatar-presets";
import { LANGUAGE_OPTIONS, type Lang } from "@deepgym/core/i18n";
import { CURRENT_ONBOARDING_VERSION, CURRENT_RELEASE } from "@deepgym/core/releases";
import {
  normalizeTrainingSchedule,
  scheduleForStorage,
  WEEKDAY_INDICES,
  type TrainingSchedule,
} from "@deepgym/core/training-schedule";
import type { Profile } from "@deepgym/core/types";
import {
  BASE_WORKOUT_TYPES,
  DEFAULT_BAR_KG,
  DEFAULT_BAR_LB,
  DEFAULT_PLATES_KG,
  DEFAULT_PLATES_LB,
} from "@deepgym/core/workout";
import { kgToUnit, parseWeight, roundWeight, unitToKg, type Unit } from "@deepgym/core/weight";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActionSheetIOS,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Path, Pattern, Rect } from "react-native-svg";

import { useMuscleGroups, useProfile, useUpdateProfile } from "../data/queries";
import { avatarSource } from "../lib/avatar-source";
import { useAuth } from "../providers/auth-provider";
import { useI18n } from "../providers/locale-provider";
import { colors, fonts, radii } from "../theme";
import { BrandMark, Button, Card, Chip, GradientCard, Segmented, Text } from "../ui";
import { ErrorState, LoadingState } from "./common";

const TOTAL_STEPS = 5;
type ScheduleMode = "unset" | "fixed" | "flexible";
type GlyphName = "dumbbell" | "settings" | "history" | "compare" | "plates" | "calendar" | "check" | "close" | "chevronLeft" | "chevronDown";

function OnboardingGlyph({ name, color, size = 20 }: { name: GlyphName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {name === "dumbbell" ? <Path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /> : null}
      {name === "settings" ? <><Circle cx={12} cy={12} r={3} /><Path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.56V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.56-1H3a2 2 0 110-4h.09a1.7 1.7 0 001.56-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34h.01a1.7 1.7 0 001-1.56V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.56h.01a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87v.01a1.7 1.7 0 001.56 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.56 1z" /></> : null}
      {name === "history" ? <Path d="M3 12a9 9 0 109-9 9.5 9.5 0 00-6.5 2.7L3 8M3 3v5h5M12 7v5l3 3" /> : null}
      {name === "compare" ? <Path d="M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3" /> : null}
      {name === "plates" ? <><Circle cx={12} cy={12} r={9} /><Circle cx={12} cy={12} r={4.5} /><Circle cx={12} cy={12} r={1} /></> : null}
      {name === "calendar" ? <><Rect x={3} y={5} width={18} height={16} rx={3} /><Path d="M8 3v4M16 3v4M3 10h18" /></> : null}
      {name === "check" ? <Path d="M20 6L9 17l-5-5" /> : null}
      {name === "close" ? <Path d="M18 6L6 18M6 6l12 12" /> : null}
      {name === "chevronLeft" ? <Path d="M15 18l-6-6 6-6" /> : null}
      {name === "chevronDown" ? <Path d="M6 9l6 6 6-6" /> : null}
    </Svg>
  );
}

function DotsOverlay() {
  return (
    <Svg pointerEvents="none" width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <Defs>
        <Pattern id="onboardingDots" patternUnits="userSpaceOnUse" width={13} height={13}>
          <Circle cx={1} cy={1} r={1} fill="#fff" fillOpacity={0.16} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#onboardingDots)" />
    </Svg>
  );
}

const WEEK_PRESETS = [
  { id: "twoDays", value: ["Upper", null, null, "Lower", null, null, null] },
  { id: "threeDays", value: ["Full Body", null, "Full Body", null, "Full Body", null, null] },
  { id: "fourDays", value: ["Upper", "Lower", null, "Upper", "Lower", null, null] },
] as const;

const WORKOUT_TYPE_KEYS = {
  Upper: "workoutType.upper",
  Lower: "workoutType.lower",
  "Full Body": "workoutType.fullBody",
  Push: "workoutType.push",
  Pull: "workoutType.pull",
} as const;

function safeNext(value: string | undefined): Href {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /^\/(onboarding|login|auth)(\/|\?|$)/.test(value)
  ) return "/";
  return value as Href;
}

export function OnboardingScreen() {
  const params = useLocalSearchParams<{ replay?: string; preview?: string; next?: string }>();
  const { t } = useI18n();
  const profileQuery = useProfile();
  const profile = profileQuery.data;
  const replay = params.replay === "1";
  const preview = __DEV__ && params.preview === "1";
  const alreadyComplete =
    (profile?.onboarding_version ?? 0) >= CURRENT_ONBOARDING_VERSION;

  useEffect(() => {
    if (profile && alreadyComplete && !replay && !preview) router.replace("/");
  }, [profile, alreadyComplete, replay, preview]);

  if (profileQuery.isLoading || (profile && alreadyComplete && !replay && !preview)) {
    return <FullPage><LoadingState /></FullPage>;
  }
  if (profileQuery.isError || !profile) {
    return (
      <FullPage>
        <ErrorState
          message={t("common.error")}
          retry={() => void profileQuery.refetch()}
        />
      </FullPage>
    );
  }

  return (
    <Wizard
      key={profile.id}
      profile={profile}
      replay={replay}
      preview={preview}
      next={safeNext(params.next)}
    />
  );
}

function FullPage({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", paddingHorizontal: 20 }}>
      {children}
    </SafeAreaView>
  );
}

function Wizard({
  profile,
  replay,
  preview,
  next,
}: {
  profile: Profile;
  replay: boolean;
  preview: boolean;
  next: Href;
}) {
  const { t, lang, setLang } = useI18n();
  const { signOut } = useAuth();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const groupsQuery = useMuscleGroups();
  const scrollRef = useRef<ScrollView>(null);
  const persistedLanguage = useRef<Lang>(profile.language ?? lang);
  const languageCommitted = useRef(false);

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => () => {
    if (!languageCommitted.current) setLang(persistedLanguage.current);
  }, [setLang]);

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

  const typeOptions = useMemo(
    () => Array.from(new Set([
      ...BASE_WORKOUT_TYPES,
      ...(groupsQuery.data?.map((group) => `Split ${group.name}`) ?? []),
      ...schedule.filter((type): type is string => Boolean(type?.trim())),
    ])),
    [groupsQuery.data, schedule],
  );

  function changeStep(nextStep: number) {
    setStepError(null);
    setStep(nextStep);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
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

  function chooseScheduleMode(next: Exclude<ScheduleMode, "unset">) {
    setScheduleMode(next);
    setStepError(null);
    if (next === "fixed" && !schedule.some(Boolean)) {
      setSchedule([...WEEK_PRESETS[1].value] as TrainingSchedule);
    }
  }

  function setDayEnabled(index: number, enabled: boolean) {
    const updated = [...schedule] as TrainingSchedule;
    updated[index] = enabled ? "" : null;
    setSchedule(updated);
    setStepError(null);
  }

  function setDayType(index: number, type: string) {
    const updated = [...schedule] as TrainingSchedule;
    updated[index] = type;
    setSchedule(updated);
    setStepError(null);
  }

  function validate(target: number): string | null {
    if (target === 1 && !name.trim()) return t("onboarding.profile.nameRequired");
    if (target === 2) {
      const bar = parseWeight(barWeight);
      if (bar == null || bar <= 0) return t("onboarding.equipment.invalidBar");
    }
    if (target === 3) {
      if (scheduleMode === "unset") return t("onboarding.schedule.required");
      if (
        scheduleMode === "fixed" &&
        (!schedule.some(Boolean) || schedule.some((type) => type !== null && !type.trim()))
      ) return t("settings.chooseTypeForEnabled");
    }
    return null;
  }

  function continueFlow() {
    const error = validate(step);
    if (error) {
      setStepError(error);
      return;
    }
    changeStep(Math.min(TOTAL_STEPS - 1, step + 1));
  }

  function exitGuide() {
    setLang(persistedLanguage.current);
    router.replace("/");
  }

  async function finish(destination: Href) {
    for (const target of [1, 2, 3]) {
      const error = validate(target);
      if (error) {
        changeStep(target);
        setStepError(error);
        return;
      }
    }
    setSaveError(null);
    if (preview) {
      setLang(persistedLanguage.current);
      router.replace(destination);
      return;
    }

    const parsedBar = parseWeight(barWeight)!;
    const unitChanged = unit !== profile.unit;
    const patch: Partial<Profile> = {
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
    // Preserve the web app's staggered-migration behavior.
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
      queryClient.setQueryData<Profile>(["profile", profile.id], { ...profile, ...patch });
      languageCommitted.current = true;
      router.replace(destination);
    } catch {
      setSaveError(t("onboarding.saveError"));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.035)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <BrandMark size={28} />
            <Text variant="micro" tone="muted" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.45 }}>{t("onboarding.progress", { current: step + 1, total: TOTAL_STEPS })}</Text>
            {replay || preview ? (
              <Pressable onPress={exitGuide} accessibilityRole="button" accessibilityLabel={t("onboarding.exitGuide")}
                style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised }}>
                <OnboardingGlyph name="close" size={18} color={colors.muted} />
              </Pressable>
            ) : <View style={{ width: 44, height: 44 }} />}
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <View key={index} style={{ flex: 1, height: 4, borderRadius: radii.pill, backgroundColor: index <= step ? colors.lime : colors.line }} />
            ))}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 32 }}
        >
          {step === 0 ? <WelcomeStep /> : null}
          {step === 1 ? (
            <ProfileStep
              name={name}
              onNameChange={(value) => { setName(value); setStepError(null); }}
              language={language}
              onLanguageChange={changeLanguage}
              unit={unit}
              onUnitChange={changeUnit}
              avatarUrl={avatarUrl}
              onAvatarSelect={setAvatarUrl}
            />
          ) : null}
          {step === 2 ? (
            <EquipmentStep
              unit={unit}
              barWeight={barWeight}
              plateValues={plateValues}
              onBarWeightChange={(value) => { setBarWeight(value); setStepError(null); }}
            />
          ) : null}
          {step === 3 ? (
            <ScheduleStep
              mode={scheduleMode}
              onModeChange={chooseScheduleMode}
              schedule={schedule}
              onScheduleChange={setSchedule}
              typeOptions={typeOptions}
              onDayEnabled={setDayEnabled}
              onDayType={setDayType}
            />
          ) : null}
          {step === 4 ? <TourStep avatarUrl={avatarUrl} /> : null}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.045)", gap: 8 }}>
          {stepError ? <Text tone="pink" variant="caption">{stepError}</Text> : null}
          {saveError ? <Text tone="pink" variant="caption">{saveError}</Text> : null}
          {step === 0 ? (
            <>
              <Button variant="lime" size="lg" block onPress={continueFlow}>{t("onboarding.welcome.start")}</Button>
              {!replay && !preview ? (
                <Button variant="ghost" block onPress={() => void signOut().catch(() => setStepError(t("common.error")))}>{t("settings.signOut")}</Button>
              ) : null}
            </>
          ) : step < TOTAL_STEPS - 1 ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button variant="surface" size="lg" iconOnly onPress={() => changeStep(step - 1)} accessibilityLabel={t("common.back")}>
                <OnboardingGlyph name="chevronLeft" color={colors.text} size={20} />
              </Button>
              <Button variant="lime" size="lg" style={{ flex: 1 }} onPress={continueFlow}>{t("onboarding.continue")}</Button>
            </View>
          ) : (
            <>
              <Button variant="lime" size="lg" block loading={updateProfile.isPending} onPress={() => void finish({ pathname: "/new", params: replay ? {} : { first: "1" } })}>
                {replay ? t("onboarding.startWorkout") : t("onboarding.startFirstWorkout")}
              </Button>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button variant="ghost" iconOnly onPress={() => changeStep(step - 1)} accessibilityLabel={t("common.back")}>
                  <OnboardingGlyph name="chevronLeft" color={colors.muted} size={19} />
                </Button>
                <Button variant="surface" style={{ flex: 1 }} loading={updateProfile.isPending} onPress={() => void finish(next)}>
                  {t("onboarding.continueToApp")}
                </Button>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text variant="micro" tone="lime" style={{ fontSize: 11, lineHeight: 15, letterSpacing: 1.75 }}>{eyebrow}</Text>
      <Text variant="heading" style={{ marginTop: 8, fontSize: 29, lineHeight: 32, fontFamily: fonts.semibold }}>{title}</Text>
      <Text tone="muted" style={{ marginTop: 12, fontSize: 14, lineHeight: 23 }}>{body}</Text>
    </View>
  );
}

function FeatureRow({ number, icon, title, body }: { number: number; icon: GlyphName; title: string; body: string }) {
  return (
    <View style={{ marginBottom: 12, borderRadius: radii.card, borderWidth: 1, borderColor: "rgba(42,42,49,0.7)", backgroundColor: "rgba(21,21,24,0.78)", padding: 16 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "rgba(215,246,81,0.18)", backgroundColor: "rgba(215,246,81,0.08)", alignItems: "center", justifyContent: "center" }}>
          <OnboardingGlyph name={icon} color={colors.lime} size={19} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text tone="faint" style={{ fontFamily: fonts.dot, fontSize: 12, lineHeight: 17 }}>{String(number).padStart(2, "0")}</Text>
            <Text weight="semibold" style={{ fontSize: 15, lineHeight: 21, flex: 1 }}>{title}</Text>
          </View>
          <Text tone="muted" style={{ marginTop: 4, fontSize: 14, lineHeight: 23 }}>{body}</Text>
        </View>
      </View>
    </View>
  );
}

function WelcomeStep() {
  const { t } = useI18n();
  const features = [
    { icon: "dumbbell", title: t("onboarding.welcome.log.title"), body: t("onboarding.welcome.log.body") },
    { icon: "settings", title: t("onboarding.welcome.remember.title"), body: t("onboarding.welcome.remember.body") },
    { icon: "history", title: t("onboarding.welcome.progress.title"), body: t("onboarding.welcome.progress.body") },
  ] as const;
  return (
    <View>
      <GradientCard variant="pink" padding={24} style={{ marginBottom: 20, minHeight: 288 }}>
        <DotsOverlay />
        <BrandMark size={42} />
        <Text variant="micro" style={{ color: "rgba(255,255,255,0.58)", marginTop: 80, fontSize: 11, letterSpacing: 1.75 }}>{t("onboarding.welcome.eyebrow")}</Text>
        <Text variant="heading" style={{ color: colors.white, marginTop: 8, fontSize: 32, lineHeight: 34, fontFamily: fonts.semibold }}>{t("onboarding.welcome.title")}</Text>
        <Text style={{ color: "rgba(255,255,255,0.68)", marginTop: 12, fontSize: 14, lineHeight: 23 }}>{t("onboarding.welcome.body")}</Text>
      </GradientCard>
      {features.map((item, index) => <FeatureRow key={item.title} number={index + 1} {...item} />)}
    </View>
  );
}

function ProfileStep({
  name, onNameChange, language, onLanguageChange, unit, onUnitChange, avatarUrl, onAvatarSelect,
}: {
  name: string;
  onNameChange: (value: string) => void;
  language: Lang;
  onLanguageChange: (value: Lang) => void;
  unit: Unit;
  onUnitChange: (value: Unit) => void;
  avatarUrl: string | null;
  onAvatarSelect: (value: string | null) => void;
}) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 20 }}>
      <StepHeader eyebrow={t("onboarding.profile.eyebrow")} title={t("onboarding.profile.title")} body={t("onboarding.profile.body")} />
      <Card radius={radii.card} padding={16}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Image source={avatarSource(avatarUrl)} style={{ width: 64, height: 64, borderRadius: 32 }} />
          <View style={{ flex: 1 }}>
            <Text weight="semibold" style={{ fontSize: 14, lineHeight: 20 }}>{t("settings.chooseAvatar")}</Text>
            <Text variant="caption" tone="faint" style={{ marginTop: 2 }}>{t("onboarding.profile.avatarOptional")}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 }}>
          {PRESET_AVATARS.map((preset) => (
            <Pressable
              key={preset.id}
              onPress={() => onAvatarSelect(preset.url)}
              accessibilityRole="radio"
              accessibilityLabel={t(preset.labelKey)}
              accessibilityState={{ checked: avatarUrl === preset.url }}
              style={{ width: "19%", alignItems: "center", justifyContent: "center" }}
            >
              <View style={{ width: 54, height: 54, borderRadius: 27, borderWidth: avatarUrl === preset.url ? 2 : 0, borderColor: colors.lime, padding: avatarUrl === preset.url ? 2 : 0 }}>
                <Image source={avatarSource(preset.url)} style={{ width: "100%", height: "100%", borderRadius: 25 }} />
              </View>
            </Pressable>
          ))}
        </View>
      </Card>
      <View style={{ gap: 8 }}>
        <Text variant="caption" tone="muted" weight="medium" style={{ fontSize: 13 }}>{t("settings.displayName")}</Text>
        <TextInput
          value={name}
          onChangeText={onNameChange}
          placeholder={t("settings.yourName")}
          placeholderTextColor={colors.faint}
          autoCapitalize="words"
          textContentType="name"
          selectionColor={colors.lime}
          style={{ height: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised, color: colors.text, fontFamily: fonts.medium, fontSize: 16, paddingHorizontal: 15 }}
        />
      </View>
      <View style={{ gap: 8 }}>
        <Text variant="caption" tone="muted" weight="medium" style={{ fontSize: 13 }}>{t("settings.language")}</Text>
        <Segmented value={language} onChange={onLanguageChange} options={LANGUAGE_OPTIONS} accessibilityLabel={t("settings.language")} />
      </View>
      <View style={{ gap: 8 }}>
        <Text variant="caption" tone="muted" weight="medium" style={{ fontSize: 13 }}>{t("settings.weightUnit")}</Text>
        <Segmented value={unit} onChange={onUnitChange} options={[{ value: "kg", label: t("settings.kilograms") }, { value: "lb", label: t("settings.pounds") }]} accessibilityLabel={t("settings.weightUnit")} />
      </View>
    </View>
  );
}

function EquipmentStep({
  unit, barWeight, plateValues, onBarWeightChange,
}: {
  unit: Unit;
  barWeight: string;
  plateValues: readonly number[];
  onBarWeightChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <View>
      <StepHeader eyebrow={t("onboarding.equipment.eyebrow")} title={t("onboarding.equipment.title")} body={t("onboarding.equipment.body")} />
      <GradientCard variant="indigo" padding={20}>
        <DotsOverlay />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.08)" }}>
            <OnboardingGlyph name="plates" size={21} color={colors.white} />
          </View>
          <View style={{ borderRadius: radii.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(0,0,0,0.15)", paddingVertical: 4, paddingHorizontal: 12 }}>
            <Text variant="micro" style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, letterSpacing: 0 }}>{unit}</Text>
          </View>
        </View>
        <Text variant="title" style={{ color: colors.white, marginTop: 32, fontSize: 18, lineHeight: 28 }}>
          {unit === "kg" ? t("onboarding.equipment.standardKg") : t("onboarding.equipment.standardLb")}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.62)", marginTop: 4, fontSize: 14, lineHeight: 20 }}>
          {t("onboarding.equipment.plateCount", { count: plateValues.length })}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {plateValues.map((plate) => (
            <View key={plate} style={{ backgroundColor: "rgba(0,0,0,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: "rgba(255,255,255,0.78)", fontFamily: fonts.dot, fontSize: 14, lineHeight: 20 }}>{plate}</Text>
            </View>
          ))}
        </View>
      </GradientCard>
      <Card radius={radii.card} padding={16} style={{ marginTop: 20 }}>
        <Text variant="caption" tone="muted" weight="medium" style={{ fontSize: 13 }}>{t("settings.barWeight", { unit })}</Text>
        <View style={{ maxWidth: 176, marginTop: 8, justifyContent: "center" }}>
          <TextInput
            value={barWeight}
            onChangeText={(value) => onBarWeightChange(value.replace(/[^\d.,]/g, ""))}
            keyboardType="decimal-pad"
            selectionColor={colors.lime}
            style={{ height: 52, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised, color: colors.text, fontFamily: fonts.dot, fontSize: 18, paddingLeft: 15, paddingRight: 48 }}
          />
          <Text variant="micro" tone="muted" style={{ position: "absolute", right: 16, fontSize: 12, letterSpacing: 0 }}>{unit}</Text>
        </View>
        <Text variant="caption" tone="muted" style={{ marginTop: 12, fontSize: 12, lineHeight: 20 }}>{t("onboarding.equipment.adjustLater")}</Text>
      </Card>
    </View>
  );
}

function ScheduleStep({
  mode, onModeChange, schedule, onScheduleChange, typeOptions, onDayEnabled, onDayType,
}: {
  mode: ScheduleMode;
  onModeChange: (value: Exclude<ScheduleMode, "unset">) => void;
  schedule: TrainingSchedule;
  onScheduleChange: (value: TrainingSchedule) => void;
  typeOptions: string[];
  onDayEnabled: (index: number, enabled: boolean) => void;
  onDayType: (index: number, type: string) => void;
}) {
  const { t, lang } = useI18n();
  const days = useMemo(() => WEEKDAY_INDICES.map((index) => {
    try {
      const day = new Intl.DateTimeFormat(lang, { weekday: "long" }).format(new Date(2024, 0, 1 + index));
      return day.charAt(0).toUpperCase() + day.slice(1);
    } catch {
      return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index];
    }
  }), [lang]);

  function pickDayType(index: number) {
    if (Platform.OS !== "ios") return;
    const labels = typeOptions.map((type) => type in WORKOUT_TYPE_KEYS
      ? t(WORKOUT_TYPE_KEYS[type as keyof typeof WORKOUT_TYPE_KEYS])
      : type);
    ActionSheetIOS.showActionSheetWithOptions(
      { title: days[index], options: [t("common.cancel"), ...labels], cancelButtonIndex: 0 },
      (selected) => {
        if (selected > 0) onDayType(index, typeOptions[selected - 1]);
      },
    );
  }

  return (
    <View>
      <StepHeader eyebrow={t("onboarding.schedule.eyebrow")} title={t("onboarding.schedule.title")} body={t("onboarding.schedule.body")} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <ModeCard selected={mode === "fixed"} label={t("onboarding.schedule.fixed")} icon="calendar" onPress={() => onModeChange("fixed")} />
        <ModeCard selected={mode === "flexible"} label={t("onboarding.schedule.flexible")} icon="dumbbell" onPress={() => onModeChange("flexible")} />
      </View>
      {mode === "fixed" ? (
        <View style={{ marginTop: 20 }}>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            {WEEK_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                onPress={() => onScheduleChange([...preset.value] as TrainingSchedule)}
                accessibilityRole="button"
                accessibilityState={{ selected: schedule.every((value, index) => value === preset.value[index]) }}
                style={{ flex: 1, minHeight: 44, borderRadius: radii.pill, borderWidth: 1, borderColor: schedule.every((value, index) => value === preset.value[index]) ? "rgba(215,246,81,0.4)" : colors.line, backgroundColor: schedule.every((value, index) => value === preset.value[index]) ? "rgba(215,246,81,0.1)" : "rgba(30,30,35,0.7)", alignItems: "center", justifyContent: "center" }}
              >
                <Text weight="medium" style={{ fontSize: 14, color: schedule.every((value, index) => value === preset.value[index]) ? colors.lime : colors.muted }} numberOfLines={1}>{t(`onboarding.schedule.${preset.id}`)}</Text>
              </Pressable>
            ))}
          </View>
          {WEEKDAY_INDICES.map((index) => {
            const enabled = schedule[index] !== null;
            return (
              <View key={index} style={{ borderRadius: radii.tile, borderWidth: 1, borderColor: enabled ? "rgba(215,246,81,0.2)" : "rgba(42,42,49,0.7)", backgroundColor: enabled ? "rgba(215,246,81,0.035)" : "rgba(30,30,35,0.7)", paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <Text weight="medium" style={{ fontSize: 14, lineHeight: 20 }}>{days[index]}</Text>
                    {!enabled ? <Text variant="caption" tone="faint" style={{ marginTop: 2 }}>{t("settings.restDay")}</Text> : null}
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={(value) => onDayEnabled(index, value)}
                    trackColor={{ false: colors.line, true: colors.lime }}
                    thumbColor={enabled ? colors.black : colors.muted}
                    accessibilityLabel={t("settings.toggleTrainingDay", { day: days[index] })}
                  />
                </View>
                {enabled ? (
                  Platform.OS === "ios" ? (
                    <Pressable
                      onPress={() => pickDayType(index)}
                      accessibilityRole="button"
                      accessibilityLabel={t("settings.workoutTypeFor", { day: days[index] })}
                      style={{ height: 44, marginTop: 12, borderRadius: radii.small, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    >
                      <Text weight="medium" style={{ fontSize: 14, color: schedule[index] ? colors.text : colors.muted, flex: 1 }} numberOfLines={1}>
                        {schedule[index]
                          ? schedule[index] in WORKOUT_TYPE_KEYS
                            ? t(WORKOUT_TYPE_KEYS[schedule[index] as keyof typeof WORKOUT_TYPE_KEYS])
                            : schedule[index]
                          : t("settings.chooseWorkoutType")}
                      </Text>
                      <OnboardingGlyph name="chevronDown" size={16} color={colors.faint} />
                    </Pressable>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingTop: 12 }}>
                      {typeOptions.map((type) => (
                        <Chip key={type} selected={schedule[index] === type} onPress={() => onDayType(index, type)}>
                          {type in WORKOUT_TYPE_KEYS ? t(WORKOUT_TYPE_KEYS[type as keyof typeof WORKOUT_TYPE_KEYS]) : type}
                        </Chip>
                      ))}
                    </ScrollView>
                  )
                ) : null}
              </View>
            );
          })}
          {schedule.some((type) => type !== null && !type.trim()) ? (
            <Text variant="caption" style={{ color: colors.flame, paddingTop: 8 }}>{t("settings.chooseTypeForEnabled")}</Text>
          ) : null}
        </View>
      ) : null}
      {mode === "flexible" ? (
        <GradientCard variant="indigo" padding={20} style={{ marginTop: 20 }}>
          <DotsOverlay />
          <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}>
            <OnboardingGlyph name="check" color={colors.white} size={19} />
          </View>
          <Text variant="title" style={{ color: colors.white, marginTop: 32, fontSize: 18, lineHeight: 28 }}>{t("onboarding.schedule.flexible")}</Text>
          <Text style={{ color: "rgba(255,255,255,0.65)", marginTop: 8, fontSize: 14, lineHeight: 23 }}>{t("onboarding.schedule.flexibleHint")}</Text>
        </GradientCard>
      ) : null}
    </View>
  );
}

function ModeCard({ selected, label, icon, onPress }: { selected: boolean; label: string; icon: GlyphName; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={{ flex: 1, minHeight: 128, borderRadius: radii.card, borderWidth: 1, borderColor: selected ? "rgba(215,246,81,0.4)" : colors.line, backgroundColor: selected ? "rgba(215,246,81,0.07)" : "rgba(21,21,24,0.72)", padding: 16, justifyContent: "space-between" }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: selected ? "rgba(215,246,81,0.25)" : colors.line, backgroundColor: selected ? "rgba(215,246,81,0.12)" : colors.raised, alignItems: "center", justifyContent: "center" }}>
        <OnboardingGlyph name={icon} color={selected ? colors.lime : colors.faint} size={18} />
      </View>
      <Text weight="semibold" style={{ color: selected ? colors.text : colors.muted, fontSize: 14, lineHeight: 18, marginTop: 16 }}>{label}</Text>
      {selected ? <View style={{ position: "absolute", top: 12, right: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.lime, alignItems: "center", justifyContent: "center" }}><OnboardingGlyph name="check" color={colors.black} size={14} /></View> : null}
    </Pressable>
  );
}

function TourStep({ avatarUrl }: { avatarUrl: string | null }) {
  const { t } = useI18n();
  const features = [
    { icon: "dumbbell", title: t("onboarding.tour.workout.title"), body: t("onboarding.tour.workout.body") },
    { icon: "plates", title: t("onboarding.tour.equipment.title"), body: t("onboarding.tour.equipment.body") },
    { icon: "history", title: t("onboarding.tour.history.title"), body: t("onboarding.tour.history.body") },
    { icon: "compare", title: t("onboarding.tour.progress.title"), body: t("onboarding.tour.progress.body") },
  ] as const;
  return (
    <View>
      <GradientCard variant="cherry" padding={20} style={{ marginBottom: 20 }}>
        <DotsOverlay />
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text variant="micro" style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, letterSpacing: 1.65 }}>{t("onboarding.tour.eyebrow")}</Text>
            <Text variant="heading" style={{ color: colors.white, marginTop: 8, fontSize: 24, lineHeight: 30 }}>{t("onboarding.tour.title")}</Text>
          </View>
          <Image source={avatarSource(avatarUrl)} style={{ width: 62, height: 62, borderRadius: 31 }} />
        </View>
        <Text style={{ color: "rgba(255,255,255,0.66)", marginTop: 20, fontSize: 14, lineHeight: 23 }}>{t("onboarding.tour.body")}</Text>
      </GradientCard>
      {features.map((item, index) => <FeatureRow key={item.title} number={index + 1} {...item} />)}
    </View>
  );
}
