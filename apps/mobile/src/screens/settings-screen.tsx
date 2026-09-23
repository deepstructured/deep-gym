import { Ionicons } from "@expo/vector-icons";
import { PRESET_AVATARS } from "@deepgym/core/avatar-presets";
import { CURRENT_RELEASE } from "@deepgym/core/releases";
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
import { decode } from "base64-arraybuffer";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient, Line, Path, Rect, Stop } from "react-native-svg";
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
import { ReleaseNotesSheet } from "../ui/release-notes-sheet";
import { ErrorState, Header, LoadingState } from "./common";

type SheetKey = "profile" | "weight" | "schedule" | "plates" | "groups" | "language";
const SHEETS: readonly SheetKey[] = ["profile", "weight", "schedule", "plates", "groups", "language"];
const AVATAR_SIZE = 384;
const AVATAR_BUCKET = "avatars";

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

async function removeOwnedStoredAvatar(url: string | null, ownerId: string) {
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const at = url?.indexOf(marker) ?? -1;
  if (at < 0) return;
  try {
    const path = decodeURIComponent(url!.slice(at + marker.length).split("?")[0]);
    if (path.startsWith(`${ownerId}/`)) {
      await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    }
  } catch {
    // The profile change has already succeeded; stale storage cleanup is best effort.
  }
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text variant="micro" tone="faint" style={{ marginLeft: 16, marginBottom: 8, fontSize: 11, lineHeight: 15, letterSpacing: 0.28, fontFamily: fonts.medium }}>{title}</Text>
      <Card radius={radii.tile} padding={0}>
        {children}
      </Card>
    </View>
  );
}

type SettingsGlyphName = "scale" | "calendar" | "plates" | "muscle" | "globe" | "info" | "widgets" | "sparkles" | "chevron" | "chevronDown";

/** The settings glyphs use the same paths as the PWA icon set. */
function SettingsGlyph({ name, color, size = 18 }: { name: SettingsGlyphName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {name === "scale" ? <><Rect x={3.5} y={3.5} width={17} height={17} rx={4} /><Path d="M8 9a5 5 0 018 0M12 9.5l1.4-2" /></> : null}
      {name === "calendar" ? <><Rect x={3} y={5} width={18} height={16} rx={3} /><Path d="M8 3v4M16 3v4M3 10h18" /></> : null}
      {name === "plates" ? <><Circle cx={12} cy={12} r={9} /><Circle cx={12} cy={12} r={4.5} /><Circle cx={12} cy={12} r={1} /></> : null}
      {name === "muscle" ? <><Path d="M5 17.5c1.5-4.5 2-8.5 1.2-12.5 2 .3 3.2 1.5 3.6 3.5" /><Path d="M9.5 9.3c2.8-1.4 6.3-.8 8.3 1.6 2 2.5 1.7 5.9-.6 7.6-2.8 2-7.8 1.6-12.2-1" /><Path d="M12.5 13.5c1.2-.7 2.8-.6 3.8.3" /></> : null}
      {name === "globe" ? <><Circle cx={12} cy={12} r={9} /><Path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></> : null}
      {name === "info" ? <><Circle cx={12} cy={12} r={9} /><Path d="M12 11v5M12 8h.01" /></> : null}
      {name === "widgets" ? <><Rect x={3.5} y={3.5} width={7} height={7} rx={2} /><Rect x={13.5} y={3.5} width={7} height={7} rx={2} /><Rect x={3.5} y={13.5} width={17} height={7} rx={2} /></> : null}
      {name === "sparkles" ? <><Path d="M11 3l1.8 4.7L17.5 9.5l-4.7 1.8L11 16l-1.8-4.7L4.5 9.5l4.7-1.8L11 3z" /><Path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" /></> : null}
      {name === "chevron" ? <Path d="M9 18l6-6-6-6" /> : null}
      {name === "chevronDown" ? <Path d="M6 9l6 6 6-6" /> : null}
    </Svg>
  );
}

function SettingsRow({
  icon,
  iconFill = "rgba(255,255,255,0.06)",
  iconBorder = "rgba(255,255,255,0.08)",
  title,
  value,
  onPress,
  trailing,
  first = false,
}: {
  icon: ReactNode;
  iconFill?: string;
  iconBorder?: string;
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
        borderColor: iconBorder,
        marginRight: 12,
      }}>
        {icon}
      </View>
      <Text weight="medium" style={{ flex: 1, fontSize: 15, lineHeight: 21 }} numberOfLines={1}>{title}</Text>
      {trailing ?? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, maxWidth: "48%" }}>
          {value ? <Text variant="caption" tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{value}</Text> : null}
          {onPress ? <SettingsGlyph name="chevron" size={17} color={colors.faint} /> : null}
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
  onBlur,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "numbers-and-punctuation";
  onBlur?: () => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="caption" tone="muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
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
  const { width: screenWidth } = useWindowDimensions();
  const compactSheet = screenWidth <= 420;
  const { signOut, user } = useAuth();
  const profileQuery = useProfile();
  const groupsQuery = useMuscleGroups();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();
  const createGroup = useCreateMuscleGroup();
  const deleteGroup = useDeleteMuscleGroup();
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
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
  const [showAvatarPresets, setShowAvatarPresets] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const profile = profileQuery.data;
  const unit = profile?.unit ?? "kg";
  const schedule = normalizeTrainingSchedule(profile?.training_schedule);
  const scheduleSummary = schedule
    .map((type, index) => type
      ? new Date(2024, 0, 1 + index).toLocaleDateString(lang, { weekday: "short" }).replace(/\.$/, "").slice(0, 2)
      : null)
    .filter(Boolean)
    .join(" · ");
  const scheduleDirty = WEEKDAY_INDICES.some((index) => scheduleDraft[index] !== schedule[index]);
  const scheduleIncomplete = scheduleDraft.some((type) => type !== null && !type.trim());
  const workoutTypes = useMemo(() => Array.from(new Set([
    ...BASE_WORKOUT_TYPES,
    ...(groupsQuery.data?.map((group) => `Split ${group.name}`) ?? []),
    ...scheduleDraft.filter((type): type is string => Boolean(type?.trim())),
  ])), [groupsQuery.data, scheduleDraft]);

  function open(next: SheetKey, current: Profile) {
    setError(null);
    setSuccess(null);
    setSheet(next);
    if (next === "profile") {
      setNameDraft(current.display_name ?? "");
      setShowAvatarPresets(false);
    }
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
    if (!name || !profile || uploadingAvatar) return;
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
    if (!profile || !user || profile.avatar_url === url || uploadingAvatar || updateProfile.isPending) return;
    const previous = profile.avatar_url;
    try {
      await updateProfile.mutateAsync({ avatar_url: url });
      await removeOwnedStoredAvatar(previous, user.id);
      setError(null);
    } catch { setError(t("common.error")); }
  }

  async function uploadAvatar() {
    if (!profile || !user || uploadingAvatar || updateProfile.isPending) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });
      if (picked.canceled || !picked.assets[0]) return;

      const asset = picked.assets[0];
      const side = Math.min(asset.width, asset.height);
      if (side <= 0) throw new Error("Could not process image");
      const image = ImageManipulator.manipulate(asset.uri);
      image.crop({
        originX: Math.floor((asset.width - side) / 2),
        originY: Math.floor((asset.height - side) / 2),
        width: side,
        height: side,
      });
      if (side > AVATAR_SIZE) image.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
      const rendered = await image.renderAsync();
      const jpeg = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.86,
        base64: true,
      });
      if (!jpeg.base64) throw new Error("Could not process image");

      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET)
        .upload(path, decode(jpeg.base64), {
          contentType: "image/jpeg",
          cacheControl: "31536000",
        });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const { data: previous } = await supabase.from("profiles")
        .select("avatar_url").eq("id", user.id).single();
      try {
        await updateProfile.mutateAsync({ avatar_url: publicUrl });
      } catch (failure) {
        await supabase.storage.from(AVATAR_BUCKET).remove([path]).catch(() => undefined);
        throw failure;
      }
      await removeOwnedStoredAvatar(previous?.avatar_url ?? null, user.id);
    } catch (failure) {
      setError(userErrorMessage(t, failure));
    } finally {
      setUploadingAvatar(false);
    }
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
    if (scheduleIncomplete) {
      setError(t("settings.chooseTypeForEnabled"));
      return;
    }
    try {
      await updateProfile.mutateAsync({ training_schedule: scheduleForStorage(scheduleDraft) });
      close();
    } catch { setError(t("common.error")); }
  }

  function pickWorkoutType(index: number, day: string) {
    if (Platform.OS !== "ios") return;
    const labels = workoutTypes.map((type) => type in WORKOUT_TYPE_KEYS ? t(WORKOUT_TYPE_KEYS[type as keyof typeof WORKOUT_TYPE_KEYS]) : type);
    ActionSheetIOS.showActionSheetWithOptions(
      { title: day, options: [t("common.cancel"), ...labels], cancelButtonIndex: 0 },
      (selected) => {
        if (selected <= 0) return;
        const next = [...scheduleDraft] as TrainingSchedule;
        next[index] = workoutTypes[selected - 1];
        setScheduleDraft(next);
        setError(null);
      },
    );
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
  const avatarBusy = uploadingAvatar || updateProfile.isPending;
  const plates = [
    ...profile.plates_kg.map((value) => ({ value, unit: "kg" as Unit, kg: value })),
    ...(profile.plates_lb ?? []).map((value) => ({ value, unit: "lb" as Unit, kg: unitToKg(value, "lb") })),
  ].sort((a, b) => b.kg - a.kg);

  return (
    <Screen bottomPadding={38}>
      <Header title={t("settings.title")} back />
      {error && !sheet ? <Text tone="pink" style={{ marginVertical: 8 }}>{error}</Text> : null}

      <Pressable onPress={() => open("profile", profile)} style={{ marginTop: 14 }} accessibilityRole="button">
        <Card padding={14}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.raised, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              <Image source={avatarImage} style={{ width: 56, height: 56 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight="semibold" numberOfLines={1} style={{ fontSize: 17, lineHeight: 23 }}>{profile.display_name || t("settings.yourName")}</Text>
              <Text variant="caption" tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>
                {profile.telegram_username ? `@${profile.telegram_username}` : t("settings.editProfile")}
              </Text>
            </View>
            <SettingsGlyph name="chevron" size={18} color={colors.faint} />
          </View>
        </Card>
      </Pressable>

      <SettingsGroup title={t("settings.groupBody")}>
        <SettingsRow first title={t("bodyWeight.title")}
          value={profile.body_weight_kg == null ? t("settings.notSet") : `${roundWeight(kgToUnit(profile.body_weight_kg, unit))} ${unit}`}
          icon={<SettingsGlyph name="scale" color={colors.lime} />}
          iconFill="rgba(215,246,81,0.1)" iconBorder="rgba(215,246,81,0.2)" onPress={() => open("weight", profile)} />
      </SettingsGroup>

      <SettingsGroup title={t("settings.groupTraining")}>
        <SettingsRow first title={t("settings.trainingWeek")}
          value={scheduleSummary || t("settings.flexible")}
          icon={<SettingsGlyph name="calendar" color="#ff8a78" />}
          iconFill="rgba(211,79,61,0.15)" iconBorder="rgba(255,98,77,0.25)" onPress={() => open("schedule", profile)} />
        <SettingsRow title={t("settings.plateCalc")}
          icon={<Ionicons name="calculator-outline" size={17} color="#aeb8ff" />}
          iconFill="rgba(24,39,136,0.3)" iconBorder="rgba(64,84,214,0.25)" onPress={() => router.push("/plate-calculator")} />
        <SettingsRow title={`${t("plates.editPlates").charAt(0).toLocaleUpperCase(lang)}${t("plates.editPlates").slice(1)}`}
          value={t("settings.platesSummary", { bar: roundWeight(kgToUnit(profile.bar_weight_kg, unit)), unit, count: plates.length })}
          icon={<SettingsGlyph name="plates" color="#aeb8ff" />}
          iconFill="rgba(24,39,136,0.3)" iconBorder="rgba(64,84,214,0.25)" onPress={() => open("plates", profile)} />
        <SettingsRow title={t("settings.muscleGroups")}
          value={String(groupsQuery.data?.length ?? "")}
          icon={<SettingsGlyph name="muscle" color={colors.pink} />}
          iconFill="rgba(245,103,181,0.12)" iconBorder="rgba(245,103,181,0.25)" onPress={() => open("groups", profile)} />
      </SettingsGroup>

      <SettingsGroup title={t("settings.groupApp")}>
        <SettingsRow first title={t("settings.language")}
          value={LANGUAGE_OPTIONS.find((option) => option.value === lang)?.label}
          icon={<SettingsGlyph name="globe" color="rgba(255,255,255,0.7)" />}
          onPress={() => open("language", profile)} />
        <SettingsRow title={t("settings.weightUnit")}
          icon={<SettingsGlyph name="scale" color="rgba(255,255,255,0.7)" />}
          trailing={<Segmented options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} value={unit} onChange={changeUnit} style={{ width: 112 }} />} />
        <SettingsRow title={t("settings.homeScreen")}
          value={t("settings.customize")}
          icon={<SettingsGlyph name="widgets" color="rgba(255,255,255,0.7)" />}
          onPress={() => router.push({ pathname: "/", params: { edit: "1" } })} />
      </SettingsGroup>

      <SettingsGroup title={t("settings.groupHelp")}>
        <SettingsRow title={t("settings.appGuide")}
          first icon={<SettingsGlyph name="info" color="rgba(255,255,255,0.7)" />}
          onPress={() => router.push("/onboarding?replay=1")} />
        <SettingsRow title={t("settings.whatsNew")}
          value={CURRENT_RELEASE.label}
          icon={<SettingsGlyph name="sparkles" color="rgba(255,255,255,0.7)" />}
          onPress={() => setWhatsNewOpen(true)} />
        <SettingsRow title={t("settings.privacyPolicy")}
          icon={<Ionicons name="shield-checkmark-outline" size={17} color={colors.text} />}
          onPress={() => router.push("/privacy")} />
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
        <View style={{ gap: 16, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Image source={avatarImage} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.raised }} />
            <View style={{ flex: 1, gap: 5 }}>
              <Button variant="surface" size="sm" loading={uploadingAvatar} disabled={avatarBusy}
                style={{ alignSelf: "flex-start" }} onPress={() => void uploadAvatar()}>
                {t("settings.uploadPhoto")}
              </Button>
              {profile.avatar_url ? (
                <Pressable onPress={() => void chooseAvatar(null)} disabled={avatarBusy} accessibilityRole="button"
                  accessibilityState={{ disabled: avatarBusy }}>
                  <Text variant="caption" tone="muted" style={{ fontSize: 12 }}>{t("settings.useDefault")}</Text>
                </Pressable>
              ) : null}
              <Text variant="caption" tone="faint" style={{ fontSize: 12, lineHeight: 16 }}>{t("settings.avatarHint")}</Text>
            </View>
          </View>
          <View>
            <Pressable
              onPress={() => setShowAvatarPresets((value) => !value)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showAvatarPresets }}
              style={{ minHeight: 42, borderRadius: radii.tile, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <Text weight="medium" style={{ fontSize: 14 }}>{t("settings.chooseAvatar")}</Text>
              <View style={{ transform: [{ rotate: showAvatarPresets ? "180deg" : "0deg" }] }}>
                <SettingsGlyph name="chevronDown" size={16} color={colors.faint} />
              </View>
            </Pressable>
            {showAvatarPresets ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14, marginTop: 12 }}>
                {PRESET_AVATARS.map((preset) => {
                  const selected = profile.avatar_url === preset.url;
                  return (
                    <Pressable key={preset.id} onPress={() => void chooseAvatar(preset.url)}
                      disabled={avatarBusy}
                      accessibilityRole="button"
                      accessibilityLabel={t(preset.labelKey)}
                      accessibilityState={{ selected, disabled: avatarBusy }}
                      style={{ width: "19%", alignItems: "center", justifyContent: "center" }}>
                      <View style={{ width: 54, height: 54, borderRadius: 27, borderWidth: selected ? 2 : 0, borderColor: colors.lime, padding: selected ? 2 : 0 }}>
                        <Image source={avatarSource(preset.url)} style={{ width: "100%", height: "100%", borderRadius: 25 }} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
          <SettingInput label={t("settings.displayName")} value={nameDraft} onChangeText={setNameDraft} placeholder={t("settings.yourName")} />
          {profile.telegram_username ? <Text variant="caption" tone="muted" style={{ fontSize: 14 }}>Telegram: <Text weight="medium">@{profile.telegram_username}</Text></Text> : null}
          {error ? <Text tone="pink">{error}</Text> : null}
          <Button variant="lime" block disabled={!nameDraft.trim() || uploadingAvatar} loading={updateProfile.isPending} onPress={saveName}>{t("common.save")}</Button>
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "groups"} onClose={close} title={t("settings.muscleGroups")} closeLabel={t("common.close")}>
        <View style={{ gap: 16, paddingBottom: 8 }}>
          <Text variant="caption" tone="muted" style={{ fontSize: 13, lineHeight: 19 }}>{t("settings.muscleGroupsHint")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(groupsQuery.data ?? []).map((group) => (
              <View key={group.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingHorizontal: 13, minHeight: 36 }}>
                <Text style={{ fontSize: 14 }}>{group.name}</Text>
                {group.user_id === user?.id ? (
                  <Pressable onPress={() => confirmDeleteGroup(group.id, group.name)} disabled={deleteGroup.isPending} accessibilityLabel={t("settings.deleteGroup", { name: group.name })}>
                    <Ionicons name="close" size={14} color={colors.faint} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={newGroupDraft}
              onChangeText={setNewGroupDraft}
              placeholder={t("settings.newGroup")}
              placeholderTextColor={colors.faint}
              selectionColor={colors.lime}
              style={{ flex: 1, height: 40, borderRadius: radii.small, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised, color: colors.text, fontFamily: fonts.regular, fontSize: 14, paddingHorizontal: 13 }}
            />
            <Button variant="surface" size="compact" leading={<Ionicons name="add" size={16} color={colors.text} />} disabled={!newGroupDraft.trim()} loading={createGroup.isPending} onPress={addGroup}>{t("common.add")}</Button>
          </View>
          {error ? <Text tone="pink">{error}</Text> : null}
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "weight"} onClose={close} title={t("bodyWeight.title")} closeLabel={t("common.close")}>
        <View style={{ gap: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: compactSheet ? "column" : "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: compactSheet ? undefined : 1 }}>
              <Text weight="semibold" style={{ fontSize: 16 }}>{t("bodyWeight.title")}</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 3, fontSize: 13, lineHeight: 18 }}>{t("bodyWeight.trackerHint")}</Text>
            </View>
            <View style={{ alignItems: compactSheet ? "flex-start" : "flex-end" }}>
              <Text variant="micro" tone="muted" style={{ fontSize: 11, letterSpacing: 0.6 }}>{t("bodyWeight.current")}</Text>
              <DotValue value={profile.body_weight_kg == null ? "—" : roundWeight(kgToUnit(profile.body_weight_kg, unit))} suffix={profile.body_weight_kg == null ? undefined : unit} size={20} />
            </View>
          </View>
          <View style={{ flexDirection: compactSheet ? "column" : "row", alignItems: compactSheet ? "stretch" : "flex-end", gap: 12 }}>
            <View style={{ flex: compactSheet ? undefined : 1 }}><SettingInput label={t("bodyWeight.inputLabel", { unit })} value={weightDraft} onChangeText={(value) => { setWeightDraft(value); setSuccess(null); }} keyboardType="decimal-pad" placeholder="80" /></View>
            <Button variant="lime" block={compactSheet} onPress={recordWeight} loading={logWeight.isPending}>{t("bodyWeight.record")}</Button>
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
            <Text weight="semibold" style={{ fontSize: 16 }}>{t("bodyWeight.historyTitle")}</Text>
            {weightQuery.data?.length ? <Text variant="micro" tone="muted" style={{ fontSize: 11 }}>{t("bodyWeight.entryCount", { count: weightQuery.data.length })}</Text> : null}
          </View>
          {weightQuery.isLoading ? <ActivityIndicator color={colors.lime} /> : weightQuery.error ? (
            <Text tone="pink">{t("common.error")}</Text>
          ) : !weightQuery.data?.length ? (
            <View style={{ gap: 5, paddingVertical: 14 }}>
              <Text tone="muted">{t("bodyWeight.historyEmpty")}</Text>
              <Text variant="caption" tone="faint">{t("bodyWeight.historyEmptyHint")}</Text>
            </View>
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
              <ScrollView nestedScrollEnabled style={{ maxHeight: 264 }} contentContainerStyle={{ paddingBottom: 12 }}>
                {weightQuery.data.map((row, index) => {
                  const older = weightQuery.data?.[index + 1];
                  const delta = older ? roundWeight(kgToUnit(row.weight_kg - older.weight_kg, unit)) : 0;
                  return (
                    <View key={row.id} style={{ flexDirection: "row", alignItems: "center", borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line, paddingVertical: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.dot, fontSize: 16, lineHeight: 20 }}>
                          {roundWeight(kgToUnit(row.weight_kg, unit))}<Text variant="caption" tone="muted" style={{ fontSize: 11 }}> {unit}</Text>
                          {delta ? <Text variant="caption" style={{ color: delta > 0 ? colors.lime : "#aeb8ff", fontSize: 11 }}>{delta > 0 ? " ▲" : " ▼"} {Math.abs(delta)}</Text> : null}
                        </Text>
                        <Text variant="caption" tone="muted" style={{ marginTop: 2, fontSize: 11 }}>{new Date(row.measured_at).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" })}</Text>
                      </View>
                      <View style={{ backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
                        <Text variant="caption" tone="muted" style={{ fontSize: 11 }}>{t(`bodyWeight.source.${row.source}`)}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "schedule"} onClose={close} title={t("settings.trainingWeek")} closeLabel={t("common.close")}>
        <View style={{ gap: 16, paddingBottom: 10 }}>
          <Text variant="caption" tone="muted" style={{ lineHeight: 20 }}>{t("settings.trainingWeekHint")}</Text>
          {WEEKDAY_INDICES.map((index) => {
            const day = new Date(2024, 0, 1 + index).toLocaleDateString(lang, { weekday: "long" });
            const active = scheduleDraft[index] !== null;
            return (
              <View key={index} style={{ backgroundColor: active ? "rgba(215,246,81,0.035)" : "rgba(30,30,35,0.7)", borderColor: active ? "rgba(215,246,81,0.2)" : "rgba(42,42,49,0.7)", borderWidth: 1, borderRadius: radii.tile, paddingVertical: 12, paddingHorizontal: 14, gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text weight="medium" style={{ fontSize: 14, lineHeight: 20, textTransform: "capitalize" }}>{day}</Text>
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
                  Platform.OS === "ios" ? (
                    <Pressable
                      onPress={() => pickWorkoutType(index, day)}
                      accessibilityRole="button"
                      accessibilityLabel={t("settings.workoutTypeFor", { day })}
                      style={{ height: 44, borderRadius: radii.small, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    >
                      <Text weight="medium" tone={scheduleDraft[index] ? "primary" : "muted"} style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>
                        {scheduleDraft[index]
                          ? scheduleDraft[index] in WORKOUT_TYPE_KEYS
                            ? t(WORKOUT_TYPE_KEYS[scheduleDraft[index] as keyof typeof WORKOUT_TYPE_KEYS])
                            : scheduleDraft[index]
                          : t("settings.chooseWorkoutType")}
                      </Text>
                      <SettingsGlyph name="chevronDown" size={16} color={colors.faint} />
                    </Pressable>
                  ) : (
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
                  )
                ) : null}
              </View>
            );
          })}
          {scheduleIncomplete ? <Text variant="caption" style={{ color: colors.flame, paddingTop: 8 }}>{t("settings.chooseTypeForEnabled")}</Text> : null}
          {error ? <Text tone="pink">{error}</Text> : null}
          <Button variant="lime" block disabled={!scheduleDirty || scheduleIncomplete} loading={updateProfile.isPending} onPress={saveSchedule}>{t("settings.saveSchedule")}</Button>
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "plates"} onClose={close} title={t("settings.plateCalc")} closeLabel={t("common.close")}>
        <View style={{ gap: 16, paddingBottom: 10 }}>
          <Text variant="caption" tone="muted" style={{ fontSize: 13, lineHeight: 19 }}>{t("settings.plateCalcHint")}</Text>
          <View style={{ maxWidth: 128 }}>
            <SettingInput label={t("settings.barWeight", { unit })} value={barDraft} onChangeText={setBarDraft} onBlur={() => void saveBar()} keyboardType="decimal-pad" />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {plates.map((plate) => (
              <Pressable key={`${plate.unit}-${plate.value}`} onPress={() => removePlate(plate.value, plate.unit)} disabled={updateProfile.isPending}
                accessibilityLabel={t("settings.removePlate", { plate: `${plate.value} ${plate.unit}` })}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 14, paddingRight: 9, minHeight: 36, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised }}>
                <Text style={{ fontFamily: fonts.dot, fontSize: 15, lineHeight: 20 }}>{plate.value}</Text><Text variant="caption" tone="muted">{plate.unit}</Text>
                <Ionicons name="close" size={14} color={colors.faint} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={plateDraft}
              onChangeText={setPlateDraft}
              placeholder={t("settings.plateWeight")}
              placeholderTextColor={colors.faint}
              keyboardType="decimal-pad"
              selectionColor={colors.lime}
              style={{ flex: 1, height: 40, borderRadius: radii.small, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised, color: colors.text, fontFamily: fonts.regular, fontSize: 14, paddingHorizontal: 13 }}
            />
            <Segmented options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} value={plateUnit} onChange={setPlateUnit} style={{ width: 98 }} />
            <Button variant="surface" size="compact" leading={<Ionicons name="add" size={16} color={colors.text} />} disabled={!plateDraft.trim()} onPress={addPlate} loading={updateProfile.isPending}>{t("common.add")}</Button>
          </View>
          {error ? <Text tone="pink">{error}</Text> : null}
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "language"} onClose={close} title={t("settings.language")} closeLabel={t("common.close")}>
        <View style={{ borderRadius: radii.tile, borderWidth: 1, borderColor: colors.line, overflow: "hidden", paddingBottom: 0, marginBottom: 8 }}>
          {LANGUAGE_OPTIONS.map((option, index) => (
            <Pressable key={option.value} onPress={() => changeLanguage(option.value)} disabled={updateProfile.isPending}
              accessibilityRole="radio" accessibilityState={{ checked: lang === option.value }}
              style={{ minHeight: 52, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: "rgba(42,42,49,0.7)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }}>
              <Text tone={lang === option.value ? "lime" : "primary"} weight="medium" style={{ fontSize: 15 }}>{option.label}</Text>
              {lang === option.value ? <Ionicons name="checkmark" size={19} color={colors.lime} /> : null}
            </Pressable>
          ))}
        </View>
        {error ? <Text tone="pink">{error}</Text> : null}
      </BottomSheet>
      <ReleaseNotesSheet open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
    </Screen>
  );
}
