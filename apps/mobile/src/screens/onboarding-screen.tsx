import { Ionicons } from "@expo/vector-icons";
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
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
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

import { useMuscleGroups, useProfile, useUpdateProfile } from "../data/queries";
import { avatarSource } from "../lib/avatar-source";
import { useAuth } from "../providers/auth-provider";
import { useI18n } from "../providers/locale-provider";
import { colors, fonts, radii } from "../theme";
import { BrandMark, Button, Card, Chip, GradientCard, Segmented, Text } from "../ui";
import { ErrorState, LoadingState } from "./common";

const TOTAL_STEPS = 5;
type ScheduleMode = "unset" | "fixed" | "flexible";
type IconName = ComponentProps<typeof Ionicons>["name"];

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
        <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 14, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <BrandMark size={27} />
            <Text variant="micro" tone="muted">{t("onboarding.progress", { current: step + 1, total: TOTAL_STEPS })}</Text>
            {replay || preview ? (
              <Pressable onPress={exitGuide} accessibilityRole="button" accessibilityLabel={t("onboarding.exitGuide")} hitSlop={10}>
                <Ionicons name="close" size={23} color={colors.muted} />
              </Pressable>
            ) : <View style={{ width: 23 }} />}
          </View>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <View key={index} style={{ flex: 1, height: 4, borderRadius: 3, backgroundColor: index <= step ? colors.lime : colors.line }} />
            ))}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30 }}
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

        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, borderTopWidth: 1, borderTopColor: colors.line, gap: 10 }}>
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
              <Button variant="surface" iconOnly onPress={() => changeStep(step - 1)} accessibilityLabel={t("common.back")}>
                <Ionicons name="chevron-back" color={colors.text} size={20} />
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
                  <Ionicons name="chevron-back" color={colors.muted} size={20} />
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
    <View style={{ gap: 8, marginBottom: 22 }}>
      <Text variant="micro" tone="lime">{eyebrow}</Text>
      <Text variant="display">{title}</Text>
      <Text tone="muted">{body}</Text>
    </View>
  );
}

function FeatureRow({ number, icon, title, body }: { number: number; icon: IconName; title: string; body: string }) {
  return (
    <Card radius={20} padding={16} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", gap: 13 }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} color={colors.lime} size={19} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text variant="micro" tone="faint">{String(number).padStart(2, "0")}</Text>
            <Text weight="semibold">{title}</Text>
          </View>
          <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>{body}</Text>
        </View>
      </View>
    </Card>
  );
}

function WelcomeStep() {
  const { t } = useI18n();
  const features = [
    { icon: "barbell-outline", title: t("onboarding.welcome.log.title"), body: t("onboarding.welcome.log.body") },
    { icon: "bookmark-outline", title: t("onboarding.welcome.remember.title"), body: t("onboarding.welcome.remember.body") },
    { icon: "stats-chart-outline", title: t("onboarding.welcome.progress.title"), body: t("onboarding.welcome.progress.body") },
  ] as const;
  return (
    <View>
      <GradientCard variant="pink" padding={25} style={{ marginBottom: 22, minHeight: 250 }}>
        <BrandMark size={42} />
        <Text variant="micro" style={{ color: colors.white, marginTop: 28 }}>{t("onboarding.welcome.eyebrow")}</Text>
        <Text variant="display" style={{ color: colors.white, marginTop: 8 }}>{t("onboarding.welcome.title")}</Text>
        <Text style={{ color: "rgba(255,255,255,0.78)", marginTop: 9 }}>{t("onboarding.welcome.body")}</Text>
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
    <View style={{ gap: 18 }}>
      <StepHeader eyebrow={t("onboarding.profile.eyebrow")} title={t("onboarding.profile.title")} body={t("onboarding.profile.body")} />
      <Card radius={22}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 15 }}>
          <Image source={avatarSource(avatarUrl)} style={{ width: 60, height: 60, borderRadius: 30 }} />
          <View style={{ flex: 1 }}>
            <Text weight="semibold">{t("settings.chooseAvatar")}</Text>
            <Text variant="caption" tone="muted">{t("onboarding.profile.avatarOptional")}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
          {PRESET_AVATARS.map((preset) => (
            <Pressable
              key={preset.id}
              onPress={() => onAvatarSelect(preset.url)}
              accessibilityRole="radio"
              accessibilityLabel={t(preset.labelKey)}
              accessibilityState={{ checked: avatarUrl === preset.url }}
              style={{ borderRadius: 28, borderWidth: 2, borderColor: avatarUrl === preset.url ? colors.lime : "transparent", padding: 2 }}
            >
              <Image source={avatarSource(preset.url)} style={{ width: 45, height: 45, borderRadius: 23 }} />
            </Pressable>
          ))}
        </View>
      </Card>
      <View style={{ gap: 8 }}>
        <Text variant="caption" tone="muted">{t("settings.displayName")}</Text>
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
        <Text variant="caption" tone="muted">{t("settings.language")}</Text>
        <Segmented value={language} onChange={onLanguageChange} options={LANGUAGE_OPTIONS} accessibilityLabel={t("settings.language")} />
      </View>
      <View style={{ gap: 8 }}>
        <Text variant="caption" tone="muted">{t("settings.weightUnit")}</Text>
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
      <GradientCard variant="indigo" padding={22}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Ionicons name="disc-outline" size={24} color={colors.white} />
          <Text variant="micro" style={{ color: colors.white }}>{unit}</Text>
        </View>
        <Text variant="title" style={{ color: colors.white, marginTop: 20 }}>
          {unit === "kg" ? t("onboarding.equipment.standardKg") : t("onboarding.equipment.standardLb")}
        </Text>
        <Text variant="caption" style={{ color: "rgba(255,255,255,0.72)", marginTop: 5 }}>
          {t("onboarding.equipment.plateCount", { count: plateValues.length })}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 15 }}>
          {plateValues.map((plate) => (
            <View key={plate} style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text variant="caption" style={{ color: colors.white }}>{plate}</Text>
            </View>
          ))}
        </View>
      </GradientCard>
      <Card radius={22} style={{ marginTop: 18 }}>
        <Text variant="caption" tone="muted">{t("settings.barWeight", { unit })}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 9 }}>
          <TextInput
            value={barWeight}
            onChangeText={(value) => onBarWeightChange(value.replace(/[^\d.,]/g, ""))}
            keyboardType="decimal-pad"
            selectionColor={colors.lime}
            style={{ flex: 1, height: 53, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised, color: colors.text, fontFamily: fonts.semibold, fontSize: 21, paddingHorizontal: 15 }}
          />
          <Text style={{ marginLeft: 10 }} tone="muted">{unit}</Text>
        </View>
        <Text variant="caption" tone="muted" style={{ marginTop: 12 }}>{t("onboarding.equipment.adjustLater")}</Text>
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

  return (
    <View>
      <StepHeader eyebrow={t("onboarding.schedule.eyebrow")} title={t("onboarding.schedule.title")} body={t("onboarding.schedule.body")} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <ModeCard selected={mode === "fixed"} label={t("onboarding.schedule.fixed")} icon="calendar-outline" onPress={() => onModeChange("fixed")} />
        <ModeCard selected={mode === "flexible"} label={t("onboarding.schedule.flexible")} icon="barbell-outline" onPress={() => onModeChange("flexible")} />
      </View>
      {mode === "fixed" ? (
        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 15 }}>
            {WEEK_PRESETS.map((preset) => (
              <Chip
                key={preset.id}
                selected={schedule.every((value, index) => value === preset.value[index])}
                onPress={() => onScheduleChange([...preset.value] as TrainingSchedule)}
              >
                {t(`onboarding.schedule.${preset.id}`)}
              </Chip>
            ))}
          </View>
          {WEEKDAY_INDICES.map((index) => {
            const enabled = schedule[index] !== null;
            return (
              <Card key={index} radius={18} padding={15} style={{ marginBottom: 9 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <Text weight="semibold">{days[index]}</Text>
                    <Text variant="caption" tone="muted">{enabled ? schedule[index] || t("settings.chooseWorkoutType") : t("settings.restDay")}</Text>
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
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingTop: 12 }}>
                    {typeOptions.map((type) => (
                      <Chip key={type} selected={schedule[index] === type} onPress={() => onDayType(index, type)}>
                        {type in WORKOUT_TYPE_KEYS
                          ? t(WORKOUT_TYPE_KEYS[type as keyof typeof WORKOUT_TYPE_KEYS])
                          : type}
                      </Chip>
                    ))}
                  </ScrollView>
                ) : null}
              </Card>
            );
          })}
        </View>
      ) : null}
      {mode === "flexible" ? (
        <GradientCard variant="indigo" padding={22} style={{ marginTop: 18 }}>
          <Ionicons name="checkmark-circle-outline" color={colors.white} size={23} />
          <Text variant="title" style={{ color: colors.white, marginTop: 12 }}>{t("onboarding.schedule.flexible")}</Text>
          <Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>{t("onboarding.schedule.flexibleHint")}</Text>
        </GradientCard>
      ) : null}
    </View>
  );
}

function ModeCard({ selected, label, icon, onPress }: { selected: boolean; label: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={{ flex: 1, minHeight: 116, borderRadius: 20, borderWidth: 1, borderColor: selected ? colors.lime : colors.line, backgroundColor: colors.surface, padding: 14, justifyContent: "space-between" }}>
      <Ionicons name={icon} color={selected ? colors.lime : colors.muted} size={22} />
      <Text weight="semibold" style={{ color: selected ? colors.text : colors.muted }}>{label}</Text>
    </Pressable>
  );
}

function TourStep({ avatarUrl }: { avatarUrl: string | null }) {
  const { t } = useI18n();
  const features = [
    { icon: "barbell-outline", title: t("onboarding.tour.workout.title"), body: t("onboarding.tour.workout.body") },
    { icon: "albums-outline", title: t("onboarding.tour.equipment.title"), body: t("onboarding.tour.equipment.body") },
    { icon: "time-outline", title: t("onboarding.tour.history.title"), body: t("onboarding.tour.history.body") },
    { icon: "stats-chart-outline", title: t("onboarding.tour.progress.title"), body: t("onboarding.tour.progress.body") },
  ] as const;
  return (
    <View>
      <GradientCard variant="cherry" padding={24} style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text variant="micro" style={{ color: colors.white }}>{t("onboarding.tour.eyebrow")}</Text>
            <Text variant="heading" style={{ color: colors.white, marginTop: 8 }}>{t("onboarding.tour.title")}</Text>
          </View>
          <Image source={avatarSource(avatarUrl)} style={{ width: 59, height: 59, borderRadius: 30 }} />
        </View>
        <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 16 }}>{t("onboarding.tour.body")}</Text>
      </GradientCard>
      {features.map((item, index) => <FeatureRow key={item.title} number={index + 1} {...item} />)}
    </View>
  );
}
