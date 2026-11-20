import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";
import type { Gym } from "@deepgym/core/types";
import { useI18n } from "../providers/locale-provider";
import { colors, radii } from "../theme";
import { BottomSheet, Button, Text } from "../ui";

interface GymSelectProps {
  gyms?: Gym[];
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  preferenceError?: boolean;
  retry?: () => void;
}

export function GymSelect({ gyms, value, onChange, includeAll = false, preferenceError, retry }: GymSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!gyms?.length && !value) return null;

  const options = [
    { id: "", name: t(includeAll ? "gym.all" : "gym.none") },
    ...(includeAll ? [{ id: "none", name: t("gym.none") }] : []),
    ...(gyms ?? []),
  ];
  const selected = options.find((option) => option.id === value);
  const label = selected?.name ?? t(gyms || retry ? "gym.unavailable" : "common.loading");

  return (
    <View style={{ marginVertical: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("gym.label")}, ${label}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          minHeight: 46, paddingHorizontal: 14, gap: 9, flexDirection: "row", alignItems: "center",
          borderWidth: 1, borderColor: colors.line, borderRadius: radii.medium,
          backgroundColor: pressed ? colors.raised : colors.surface,
        })}
      >
        <Ionicons name="location-outline" size={18} color={colors.muted} />
        <Text tone="muted">{t("gym.label")}</Text>
        <Text numberOfLines={1} weight="medium" style={{ flex: 1, textAlign: "right" }}>{label}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      {preferenceError && <Text accessibilityRole="alert" variant="caption" tone="pink" style={{ marginTop: 6 }}>{t("gym.preferenceError")}</Text>}
      {!selected && retry ? (
        <Button variant="ghost" size="compact" onPress={retry}>{t("common.retry")}</Button>
      ) : !selected && gyms ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>{t("gym.deletedHint")}</Text>
      ) : null}
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("gym.label")} closeLabel={t("common.close")}>
        {options.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === option.id }}
            onPress={() => { onChange(option.id); setOpen(false); }}
            style={{ minHeight: 48, paddingVertical: 10, alignItems: "center", flexDirection: "row", gap: 12 }}
          >
            <Text style={{ flex: 1 }}>{option.name}</Text>
            {value === option.id ? <Ionicons name="checkmark" size={20} color={colors.lime} /> : null}
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}
