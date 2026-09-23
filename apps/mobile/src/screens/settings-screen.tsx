import { Ionicons } from "@expo/vector-icons";
import { PRESET_AVATARS } from "@deepgym/core/avatar-presets";
import {
  LANGUAGE_OPTIONS,
  type Lang,
} from "@deepgym/core/i18n";
import {
  normalizeTrainingSchedule,
  scheduleForStorage,
  WEEKDAY_INDICES,
  type TrainingSchedule,
} from "@deepgym/core/training-schedule";
import type { Profile } from "@deepgym/core/types";
import { BASE_WORKOUT_TYPES } from "@deepgym/core/workout";
import { kgToUnit, parseWeight, roundWeight, unitToKg, type Unit } from "@deepgym/core/weight";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from "react-native-svg";
import {
  useBodyWeightMeasurements,
  useLogBodyWeight,
  type BodyWeightMeasurement,
} from "../data/body-weight";
import { useDeleteAccount } from "../data/account";
import { useCreateMuscleGroup, useDeleteMuscleGroup } from "../data/muscle-groups";
import { useMuscleGroups, useProfile, useUpdateProfile } from "../data/queries";
import { avatarSource } from "../lib/avatar-source";
import { userErrorMessage } from "../lib/user-error";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/auth-provider";
import { useI18n } from "../providers/locale-provider";
import { colors, fonts, radii } from "../theme";
import { BottomSheet, Button, Card, Chip, DotValue, Screen, Segmented, Text } from "../ui";
import { ErrorState, Header, LoadingState } from "./common";

type SheetKey = "profile" | "weight" | "schedule" | "plates" | "groups" | "language";
const SHEETS: readonly SheetKey[] = ["profile", "weight", "schedule", "plates", "groups", "language"];

const WORKOUT_TYPE_KEYS = {
  Upper: "workoutType.upper",
  Lower: "workoutType.lower",
  "Full Body": "workoutType.fullBody",
  Push: "workoutType.push",
  Pull: "workoutType.pull",
} as const;

const INPUT_COPY = {
  en: { date: "Date (YYYY-MM-DD)", time: "Time (HH:mm)", invalidBar: "Enter a valid bar weight", invalidPlate: "Enter a valid plate weight" },
  ru: { date: "Дата (ГГГГ-ММ-ДД)", time: "Время (ЧЧ:мм)", invalidBar: "Укажите корректный вес грифа", invalidPlate: "Укажите корректный вес блина" },
  uk: { date: "Дата (РРРР-ММ-ДД)", time: "Час (ГГ:хх)", invalidBar: "Вкажіть коректну вагу грифа", invalidPlate: "Вкажіть коректну вагу млинця" },
} as const;

function localDateTimeParts(date = new Date()) {
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const timePart = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join(":");
  return { datePart, timePart };
}

function toMeasuredAt(datePart: string, timePart: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !/^\d{2}:\d{2}$/.test(timePart)) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const value = new Date(year, month - 1, day, hour, minute);
  if (
    value.getFullYear() !== year || value.getMonth() !== month - 1 ||
    value.getDate() !== day || value.getHours() !== hour || value.getMinutes() !== minute ||
    value.getTime() > Date.now() + 5 * 60_000
  ) return null;
  return value.toISOString();
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 23 }}>
      <Text variant="micro" tone="faint" style={{ marginLeft: 15, marginBottom: 9 }}>{title}</Text>
      <Card radius={radii.tile} padding={0}>
        {children}
      </Card>
    </View>
  );
}

function SettingsRow({
  icon,
  iconFill = "rgba(255,255,255,0.06)",
  title,
  value,
  onPress,
  trailing,
  first = false,
}: {
  icon: ReactNode;
  iconFill?: string;
  title: string;
  value?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  first?: boolean;
}) {
  const content = (
    <>
      <View style={{
        width: 32,
        height: 32,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: iconFill,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        marginRight: 12,
      }}>
        {icon}
      </View>
      <Text style={{ flex: 1 }} numberOfLines={1}>{title}</Text>
      {trailing ?? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, maxWidth: "48%" }}>
          {value ? <Text variant="caption" tone="muted" numberOfLines={1}>{value}</Text> : null}
          {onPress ? <Ionicons name="chevron-forward" size={15} color={colors.faint} /> : null}
        </View>
      )}
    </>
  );
  const rowStyle = {
        minHeight: 53,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 13,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: "rgba(255,255,255,0.055)",
      } as const;
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [rowStyle, { backgroundColor: pressed ? "rgba(255,255,255,0.035)" : "transparent" }]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={rowStyle}>{content}</View>
  );
}

function SettingInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "numbers-and-punctuation";
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="caption" tone="muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
        selectionColor={colors.lime}
        style={{
          minHeight: 49,
          borderRadius: 13,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.raised,
          color: colors.text,
          fontFamily: fonts.regular,
          fontSize: 16,
          paddingHorizontal: 15,
        }}
      />
    </View>
  );
}

function BodyWeightChart({ rows, accessibilityLabel }: { rows: BodyWeightMeasurement[]; accessibilityLabel: string }) {
  const [width, setWidth] = useState(0);
  const ordered = useMemo(() => [...rows].reverse(), [rows]);
  const values = ordered.map((item) => item.weight_kg);
  const minimum = Math.min(...values) - 0.5;
  const maximum = Math.max(...values) + 0.5;
  const chartWidth = Math.max(width, 1);
  const left = 9;
  const right = chartWidth - 9;
  const top = 16;
  const bottom = 132;
  const points = ordered.map((row, index) => ({
    x: left + (ordered.length === 1 ? 0.5 : index / (ordered.length - 1)) * (right - left),
    y: bottom - ((row.weight_kg - minimum) / (maximum - minimum)) * (bottom - top),
  }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = points.length ? `${line} L${points.at(-1)!.x},${bottom} L${points[0].x},${bottom} Z` : "";

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityLabel={accessibilityLabel}
      style={{ height: 154, borderRadius: radii.medium, borderWidth: 1, borderColor: colors.line, backgroundColor: "#101117", overflow: "hidden" }}
    >
      {width > 0 ? (
        <Svg width={width} height={154}>
          <Defs>
            <LinearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.lime} stopOpacity={0.24} />
              <Stop offset="1" stopColor={colors.lime} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[36, 78, 120].map((y) => (
            <Line key={y} x1={8} x2={width - 8} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeDasharray="2 4" />
          ))}
          {area ? <Path d={area} fill="url(#weightFill)" /> : null}
          <Path d={line} fill="none" stroke={colors.lime} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.length ? <Circle cx={points.at(-1)!.x} cy={points.at(-1)!.y} r={4} fill={colors.lime} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

export function SettingsScreen() {
  const { t, lang, setLang } = useI18n();
  const { signOut, user } = useAuth();
  const profileQuery = useProfile();
  const groupsQuery = useMuscleGroups();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();
  const createGroup = useCreateMuscleGroup();
  const deleteGroup = useDeleteMuscleGroup();
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const weightQuery = useBodyWeightMeasurements({ limit: 365, enabled: sheet === "weight" });
  const logWeight = useLogBodyWeight();
  const params = useLocalSearchParams<{ open?: string }>();
  const deepLinkOpened = useRef(false);

  const [nameDraft, setNameDraft] = useState("");
  const [weightDraft, setWeightDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const [timeDraft, setTimeDraft] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState<TrainingSchedule>(() => normalizeTrainingSchedule(null));
  const [barDraft, setBarDraft] = useState("");
  const [plateDraft, setPlateDraft] = useState("");
  const [plateUnit, setPlateUnit] = useState<Unit>("kg");
  const [newGroupDraft, setNewGroupDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const profile = profileQuery.data;
  const privacyPolicyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  const unit = profile?.unit ?? "kg";
  const schedule = normalizeTrainingSchedule(profile?.training_schedule);
  const scheduleSummary = schedule
    .map((type, index) => type
      ? new Date(2024, 0, 1 + index).toLocaleDateString(lang, { weekday: "short" })
      : null)
    .filter(Boolean)
    .join(" · ");
  const workoutTypes = useMemo(() => Array.from(new Set([
    ...BASE_WORKOUT_TYPES,
    ...(groupsQuery.data?.map((group) => `Split ${group.name}`) ?? []),
    ...scheduleDraft.filter((type): type is string => Boolean(type?.trim())),
  ])), [groupsQuery.data, scheduleDraft]);

  function open(next: SheetKey, current: Profile) {
    setError(null);
    setSuccess(null);
    setSheet(next);
    if (next === "profile") setNameDraft(current.display_name ?? "");
    if (next === "weight") {
      setWeightDraft(current.body_weight_kg == null ? "" : String(roundWeight(kgToUnit(current.body_weight_kg, current.unit))));
      const now = localDateTimeParts();
      setDateDraft(now.datePart);
      setTimeDraft(now.timePart);
    }
    if (next === "schedule") setScheduleDraft(normalizeTrainingSchedule(current.training_schedule));
    if (next === "plates") {
      setBarDraft(String(roundWeight(kgToUnit(current.bar_weight_kg, current.unit))));
      setPlateDraft("");
      setPlateUnit(current.unit);
    }
  }

  useEffect(() => {
    if (deepLinkOpened.current || !profile) return;
    if (typeof params.open === "string" && SHEETS.includes(params.open as SheetKey)) {
      deepLinkOpened.current = true;
      open(params.open as SheetKey, profile);
    }
  }, [params.open, profile]);

  const close = () => { setSheet(null); setError(null); setSuccess(null); };

  async function saveName() {
    const name = nameDraft.trim();
    if (!name || !profile) return;
    if (name !== profile.display_name) {
      try { await updateProfile.mutateAsync({ display_name: name }); }
      catch { setError(t("common.error")); return; }
    }
    close();
  }

  async function changeLanguage(next: Lang) {
    if (next !== lang) {
      try { await updateProfile.mutateAsync({ language: next }); }
      catch { setError(t("common.error")); return; }
      setLang(next);
    }
    close();
  }

  async function chooseAvatar(url: string | null) {
    if (!profile || !user || profile.avatar_url === url) return;
    const previous = profile.avatar_url;
    try {
      await updateProfile.mutateAsync({ avatar_url: url });
      const marker = "/storage/v1/object/public/avatars/";
      const at = previous?.indexOf(marker) ?? -1;
      if (at >= 0) {
        const path = decodeURIComponent(previous!.slice(at + marker.length).split("?")[0]);
        if (path.startsWith(`${user.id}/`)) {
          await supabase.storage.from("avatars").remove([path]);
        }
      }
      setError(null);
    } catch { setError(t("common.error")); }
  }

  async function addGroup() {
    if (!newGroupDraft.trim()) return;
    try {
      await createGroup.mutateAsync(newGroupDraft);
      setNewGroupDraft("");
      setError(null);
    } catch (failure) {
      setError(userErrorMessage(t, failure));
    }
  }

  function confirmDeleteGroup(id: string, name: string) {
    Alert.alert(t("settings.deleteGroup", { name }), t("settings.deleteGroupMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"), style: "destructive",
        onPress: () => deleteGroup.mutate(id, {
          onError: (failure) => setError(userErrorMessage(t, failure)),
          onSuccess: () => setError(null),
        }),
      },
    ]);
  }

  async function changeUnit(next: Unit) {
    if (next === unit) return;
    try { await updateProfile.mutateAsync({ unit: next }); setError(null); }
    catch { setError(t("common.error")); }
  }

  async function saveSchedule() {
    if (scheduleDraft.some((type) => type !== null && !type.trim())) {
      setError(t("settings.chooseTypeForEnabled"));
      return;
    }
    try {
      await updateProfile.mutateAsync({ training_schedule: scheduleForStorage(scheduleDraft) });
      close();
    } catch { setError(t("common.error")); }
  }

  async function recordWeight() {
    const parsed = parseWeight(weightDraft);
    if (parsed == null) { setError(t("bodyWeight.invalid")); return; }
    const measuredAt = toMeasuredAt(dateDraft, timeDraft);
    if (!measuredAt) { setError(t("bodyWeight.invalidTimestamp")); return; }
    try {
      await logWeight.mutateAsync({ weightKg: Math.round(unitToKg(parsed, unit) * 1000) / 1000, measuredAt });
      setError(null);
      setSuccess(t("bodyWeight.saved"));
    } catch { setError(t("common.error")); }
  }

  async function saveBar() {
    const parsed = parseWeight(barDraft);
    if (parsed == null) { setError(INPUT_COPY[lang].invalidBar); return; }
    try {
      await updateProfile.mutateAsync({ bar_weight_kg: Math.round(unitToKg(parsed, unit) * 100) / 100 });
      setError(null);
    } catch { setError(t("common.error")); }
  }

  async function addPlate() {
    if (!profile) return;
    const parsed = parseWeight(plateDraft);
    if (parsed == null) { setError(INPUT_COPY[lang].invalidPlate); return; }
    const key = plateUnit === "kg" ? "plates_kg" : "plates_lb";
    const current = profile[key] ?? [];
    if (current.includes(parsed)) { setPlateDraft(""); return; }
    try {
      await updateProfile.mutateAsync({ [key]: [...current, parsed] });
      setPlateDraft("");
      setError(null);
    } catch { setError(t("common.error")); }
  }

  async function removePlate(value: number, plateUnit: Unit) {
    if (!profile) return;
    const key = plateUnit === "kg" ? "plates_kg" : "plates_lb";
    try {
      await updateProfile.mutateAsync({ [key]: (profile[key] ?? []).filter((item) => item !== value) });
      setError(null);
    } catch { setError(t("common.error")); }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); router.replace("/login"); }
    catch { setSigningOut(false); setError(t("common.error")); }
  }

  function confirmDeleteAccount() {
    Alert.alert(t("settings.deleteAccountTitle"), t("settings.deleteAccountMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.deleteAccount"),
        style: "destructive",
        onPress: () => deleteAccount.mutate(undefined, {
          onSuccess: () => router.replace("/login"),
          onError: (failure) => Alert.alert(t("common.error"), userErrorMessage(t, failure, "settings.deleteAccountFailed")),
        }),
      },
    ]);
  }

  if (profileQuery.isLoading) return <Screen><Header title={t("settings.title")} back /><LoadingState /></Screen>;
  if (!profile) return <Screen><Header title={t("settings.title")} back /><ErrorState message={t("common.error")} retry={() => profileQuery.refetch()} /></Screen>;

  const avatarImage = avatarSource(profile.avatar_url);
  const plates = [
    ...profile.plates_kg.map((value) => ({ value, unit: "kg" as Unit, kg: value })),
    ...(profile.plates_lb ?? []).map((value) => ({ value, unit: "lb" as Unit, kg: unitToKg(value, "lb") })),
  ].sort((a, b) => b.kg - a.kg);

  return (
    <Screen bottomPadding={38}>
      <Header title={t("settings.title")} back />
      {error && !sheet ? <Text tone="pink" style={{ marginVertical: 8 }}>{error}</Text> : null}

      <Pressable onPress={() => open("profile", profile)} style={{ marginTop: 14 }} accessibilityRole="button">
        <Card padding={15}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.raised, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              <Image source={avatarImage} style={{ width: 56, height: 56 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight="semibold" numberOfLines={1}>{profile.display_name || t("settings.yourName")}</Text>
              <Text variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 3 }}>
                {profile.telegram_username ? `@${profile.telegram_username}` : t("settings.editProfile")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </View>
        </Card>
      </Pressable>

      <SettingsGroup title={t("settings.groupBody")}>
        <SettingsRow first title={t("bodyWeight.title")}
          value={profile.body_weight_kg == null ? t("settings.notSet") : `${roundWeight(kgToUnit(profile.body_weight_kg, unit))} ${unit}`}
          icon={<Ionicons name="scale-outline" size={17} color={colors.lime} />}
          iconFill="rgba(215,246,81,0.1)" onPress={() => open("weight", profile)} />
      </SettingsGroup>

      <SettingsGroup title={t("settings.groupTraining")}>
        <SettingsRow first title={t("settings.trainingWeek")}
          value={scheduleSummary || t("settings.flexible")}
          icon={<Ionicons name="calendar-outline" size={17} color={colors.cherryBright} />}
          iconFill="rgba(211,79,61,0.14)" onPress={() => open("schedule", profile)} />
        <SettingsRow title={t("settings.plateCalc")}
          icon={<Ionicons name="calculator-outline" size={17} color="#aeb8ff" />}
          iconFill="rgba(24,39,136,0.35)" onPress={() => router.push("/plate-calculator")} />
        <SettingsRow title={`${t("plates.editPlates").charAt(0).toLocaleUpperCase(lang)}${t("plates.editPlates").slice(1)}`}
          value={t("settings.platesSummary", { bar: roundWeight(kgToUnit(profile.bar_weight_kg, unit)), unit, count: plates.length })}
          icon={<Ionicons name="disc-outline" size={17} color="#aeb8ff" />}
          iconFill="rgba(24,39,136,0.35)" onPress={() => open("plates", profile)} />
        <SettingsRow title={t("settings.muscleGroups")}
          value={String(groupsQuery.data?.length ?? "")}
          icon={<Ionicons name="fitness-outline" size={17} color={colors.pink} />}
          iconFill="rgba(245,103,181,0.12)" onPress={() => open("groups", profile)} />
      </SettingsGroup>

      <SettingsGroup title={t("settings.groupApp")}>
        <SettingsRow first title={t("settings.language")}
          value={LANGUAGE_OPTIONS.find((option) => option.value === lang)?.label}
          icon={<Ionicons name="globe-outline" size={17} color={colors.text} />}
          onPress={() => open("language", profile)} />
        <SettingsRow title={t("settings.weightUnit")}
          icon={<Ionicons name="scale-outline" size={17} color={colors.text} />}
          trailing={<Segmented options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} value={unit} onChange={changeUnit} style={{ width: 112, padding: 2 }} />} />
        <SettingsRow title={t("settings.appGuide")}
          icon={<Ionicons name="book-outline" size={17} color={colors.text} />}
          onPress={() => router.push("/onboarding?replay=1")} />
        {privacyPolicyUrl?.startsWith("https://") ? (
          <SettingsRow title={t("settings.privacyPolicy")}
            icon={<Ionicons name="shield-checkmark-outline" size={17} color={colors.text} />}
            onPress={() => void Linking.openURL(privacyPolicyUrl).catch(() => setError(t("common.error")))} />
        ) : null}
      </SettingsGroup>

      <SettingsGroup title={t("settings.groupAccount")}>
        <SettingsRow first title={t("settings.signOut")}
          icon={<Ionicons name="log-out-outline" size={17} color={colors.muted} />}
          trailing={signingOut ? <ActivityIndicator color={colors.lime} /> : undefined}
          onPress={handleSignOut} />
        <SettingsRow title={t("settings.deleteAccount")}
          icon={<Ionicons name="trash-outline" size={17} color={colors.flameText} />}
          iconFill="rgba(224,75,46,0.14)"
          trailing={deleteAccount.isPending ? <ActivityIndicator color={colors.flameText} /> : undefined}
          onPress={confirmDeleteAccount} />
      </SettingsGroup>

      <BottomSheet open={sheet === "profile"} onClose={close} title={t("settings.profile")} closeLabel={t("common.close")}>
        <View style={{ gap: 18, paddingBottom: 8 }}>
          <SettingInput label={t("settings.displayName")} value={nameDraft} onChangeText={setNameDraft} placeholder={t("settings.yourName")} />
          {profile.telegram_username ? <Text variant="caption" tone="muted">Telegram: @{profile.telegram_username}</Text> : null}
          <Text variant="caption" tone="muted">{t("settings.chooseAvatar")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {PRESET_AVATARS.map((preset) => {
              const selected = profile.avatar_url === preset.url;
              return (
                <Pressable key={preset.id} onPress={() => void chooseAvatar(preset.url)}
                  disabled={updateProfile.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={t(preset.labelKey)}
                  accessibilityState={{ selected, disabled: updateProfile.isPending }}
                  style={{ width: 58, height: 58, borderRadius: 29, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.lime : colors.line, backgroundColor: colors.raised, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                  <Image source={avatarSource(preset.url)} style={{ width: 54, height: 54, borderRadius: 27 }} />
                </Pressable>
              );
            })}
          </View>
          {error ? <Text tone="pink">{error}</Text> : null}
          <Button variant="lime" block disabled={!nameDraft.trim()} loading={updateProfile.isPending} onPress={saveName}>{t("common.save")}</Button>
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "groups"} onClose={close} title={t("settings.muscleGroups")} closeLabel={t("common.close")}>
        <View style={{ gap: 15, paddingBottom: 8 }}>
          <Text variant="caption" tone="muted">{t("settings.muscleGroupsHint")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(groupsQuery.data ?? []).map((group) => (
              <View key={group.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.raised, borderRadius: radii.pill, paddingLeft: 13, paddingRight: group.user_id ? 7 : 13, minHeight: 38 }}>
                <Text>{group.name}</Text>
                {group.user_id === user?.id ? (
                  <Pressable onPress={() => confirmDeleteGroup(group.id, group.name)} disabled={deleteGroup.isPending} accessibilityLabel={t("settings.deleteGroup", { name: group.name })}>
                    <Ionicons name="close" size={17} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
          <SettingInput label={t("settings.newGroup")} value={newGroupDraft} onChangeText={setNewGroupDraft} />
          {error ? <Text tone="pink">{error}</Text> : null}
          <Button variant="lime" block disabled={!newGroupDraft.trim()} loading={createGroup.isPending} onPress={addGroup}>{t("common.add")}</Button>
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "weight"} onClose={close} title={t("bodyWeight.title")} closeLabel={t("common.close")}>
        <View style={{ gap: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text weight="semibold">{t("bodyWeight.title")}</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 3 }}>{t("bodyWeight.trackerHint")}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text variant="micro" tone="faint">{t("bodyWeight.current")}</Text>
              <DotValue value={profile.body_weight_kg == null ? "—" : roundWeight(kgToUnit(profile.body_weight_kg, unit))} suffix={profile.body_weight_kg == null ? undefined : unit} size={24} />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
            <View style={{ flex: 1 }}><SettingInput label={t("bodyWeight.inputLabel", { unit })} value={weightDraft} onChangeText={(value) => { setWeightDraft(value); setSuccess(null); }} keyboardType="decimal-pad" placeholder="80" /></View>
            <Button variant="lime" onPress={recordWeight} loading={logWeight.isPending}>{t("bodyWeight.record")}</Button>
          </View>
          <Text variant="caption" tone="muted">{t("bodyWeight.measuredAt")}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1.4 }}><SettingInput label={INPUT_COPY[lang].date} value={dateDraft} onChangeText={setDateDraft} keyboardType="numbers-and-punctuation" /></View>
            <View style={{ flex: 1 }}><SettingInput label={INPUT_COPY[lang].time} value={timeDraft} onChangeText={setTimeDraft} keyboardType="numbers-and-punctuation" /></View>
          </View>
          {success ? <Text tone="lime">{success}</Text> : null}
          {error ? <Text tone="pink">{error}</Text> : null}
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 7 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text weight="semibold">{t("bodyWeight.historyTitle")}</Text>
            {weightQuery.data?.length ? <Text variant="micro" tone="faint">{t("bodyWeight.entryCount", { count: weightQuery.data.length })}</Text> : null}
          </View>
          {weightQuery.isLoading ? <ActivityIndicator color={colors.lime} /> : weightQuery.error ? (
            <Text tone="pink">{t("common.error")}</Text>
          ) : !weightQuery.data?.length ? (
            <Text tone="muted">{t("bodyWeight.historyEmpty")}</Text>
          ) : (
            <>
              <BodyWeightChart
                rows={weightQuery.data}
                accessibilityLabel={t("bodyWeight.chartAria", {
                  from: roundWeight(kgToUnit(weightQuery.data.at(-1)!.weight_kg, unit)),
                  to: roundWeight(kgToUnit(weightQuery.data[0].weight_kg, unit)),
                  unit,
                })}
              />
              <View style={{ gap: 0 }}>
                {weightQuery.data.map((row, index) => {
                  const older = weightQuery.data?.[index + 1];
                  const delta = older ? roundWeight(kgToUnit(row.weight_kg - older.weight_kg, unit)) : 0;
                  return (
                    <View key={row.id} style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text weight="semibold">{roundWeight(kgToUnit(row.weight_kg, unit))} {unit} {delta ? <Text variant="caption" tone={delta > 0 ? "pink" : "lime"}>{delta > 0 ? "▲" : "▼"} {Math.abs(delta)}</Text> : null}</Text>
                        <Text variant="caption" tone="muted">{new Date(row.measured_at).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" })}</Text>
                      </View>
                      <Text variant="caption" tone="faint">{t(`bodyWeight.source.${row.source}`)}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "schedule"} onClose={close} title={t("settings.trainingWeek")} closeLabel={t("common.close")}>
        <View style={{ gap: 12, paddingBottom: 10 }}>
          <Text variant="caption" tone="muted">{t("settings.trainingWeekHint")}</Text>
          {WEEKDAY_INDICES.map((index) => {
            const day = new Date(2024, 0, 1 + index).toLocaleDateString(lang, { weekday: "long" });
            const active = scheduleDraft[index] !== null;
            return (
              <View key={index} style={{ backgroundColor: colors.raised, borderRadius: radii.medium, padding: 13, gap: 9 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text weight="semibold" style={{ textTransform: "capitalize" }}>{day}</Text>
                    {!active ? <Text variant="caption" tone="faint">{t("settings.restDay")}</Text> : null}
                  </View>
                  <Switch
                    value={active}
                    onValueChange={(enabled) => {
                      const next = [...scheduleDraft] as TrainingSchedule;
                      next[index] = enabled ? "" : null;
                      setScheduleDraft(next);
                      setError(null);
                    }}
                    trackColor={{ false: colors.line, true: colors.lime }}
                    thumbColor={active ? colors.black : colors.muted}
                    accessibilityLabel={t("settings.toggleTrainingDay", { day })}
                  />
                </View>
                {active ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingRight: 3 }}>
                    {workoutTypes.map((type) => (
                      <Chip key={type} selected={scheduleDraft[index] === type} onPress={() => {
                        const next = [...scheduleDraft] as TrainingSchedule;
                        next[index] = type;
                        setScheduleDraft(next);
                        setError(null);
                      }}>
                        {type in WORKOUT_TYPE_KEYS ? t(WORKOUT_TYPE_KEYS[type as keyof typeof WORKOUT_TYPE_KEYS]) : type}
                      </Chip>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            );
          })}
          {error ? <Text tone="pink">{error}</Text> : null}
          <Button variant="lime" block loading={updateProfile.isPending} onPress={saveSchedule}>{t("settings.saveSchedule")}</Button>
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "plates"} onClose={close} title={t("settings.plateCalc")} closeLabel={t("common.close")}>
        <View style={{ gap: 16, paddingBottom: 10 }}>
          <Text variant="caption" tone="muted">{t("settings.plateCalcHint")}</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
            <View style={{ flex: 1 }}><SettingInput label={t("settings.barWeight", { unit })} value={barDraft} onChangeText={setBarDraft} keyboardType="decimal-pad" /></View>
            <Button variant="surface" onPress={saveBar} loading={updateProfile.isPending}>{t("common.save")}</Button>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {plates.map((plate) => (
              <Pressable key={`${plate.unit}-${plate.value}`} onPress={() => removePlate(plate.value, plate.unit)} disabled={updateProfile.isPending}
                accessibilityLabel={t("settings.removePlate", { plate: `${plate.value} ${plate.unit}` })}
                style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, minHeight: 38, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised }}>
                <Text weight="semibold">{plate.value}</Text><Text variant="caption" tone="muted">{plate.unit}</Text>
                <Ionicons name="close" size={15} color={colors.muted} />
              </Pressable>
            ))}
          </View>
          <SettingInput label={t("settings.plateWeight")} value={plateDraft} onChangeText={setPlateDraft} keyboardType="decimal-pad" />
          <Segmented options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} value={plateUnit} onChange={setPlateUnit} />
          {error ? <Text tone="pink">{error}</Text> : null}
          <Button variant="lime" block onPress={addPlate} loading={updateProfile.isPending}>{t("common.add")}</Button>
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "language"} onClose={close} title={t("settings.language")} closeLabel={t("common.close")}>
        <View style={{ gap: 8, paddingBottom: 8 }}>
          {LANGUAGE_OPTIONS.map((option) => (
            <Pressable key={option.value} onPress={() => changeLanguage(option.value)} disabled={updateProfile.isPending}
              accessibilityRole="radio" accessibilityState={{ checked: lang === option.value }}
              style={{ minHeight: 48, borderRadius: radii.medium, backgroundColor: lang === option.value ? "rgba(215,246,81,0.12)" : colors.raised, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 15 }}>
              <Text tone={lang === option.value ? "lime" : "primary"} weight="medium">{option.label}</Text>
              {lang === option.value ? <Ionicons name="checkmark" size={19} color={colors.lime} /> : null}
            </Pressable>
          ))}
          {error ? <Text tone="pink">{error}</Text> : null}
        </View>
      </BottomSheet>
    </Screen>
  );
}
