import { Ionicons } from "@expo/vector-icons";
import type { Gym } from "@deepgym/core/types";
import { Pressable, View } from "react-native";
import { useI18n } from "../providers/locale-provider";
import { colors } from "../theme";
import { Button, Segmented, Text } from "../ui";

// null means universal. An empty selection is allowed while editing, but cannot be saved.
export type ExerciseAvailability = string[] | null;

export function ExerciseAvailabilityField({ gyms, value, onChange, suggestedGymId, requiredGymId, retry }: {
  gyms?: Gym[];
  value: ExerciseAvailability;
  onChange: (value: ExerciseAvailability) => void;
  suggestedGymId?: string | null;
  requiredGymId?: string | null;
  retry?: () => void;
}) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 8, marginBottom: 18 }}>
      <Text variant="micro" tone="muted">{t("gym.availability")}</Text>
      <Segmented
        accessibilityLabel={t("gym.availability")}
        options={[
          { value: "universal", label: t("gym.universal") },
          { value: "specific", label: t("gym.specific") },
        ]}
        value={value === null ? "universal" : "specific"}
        onChange={mode => {
          if (mode === "universal") onChange(null);
          else if (value === null) {
            const initialId = requiredGymId ?? suggestedGymId;
            onChange(initialId && gyms?.some(gym => gym.id === initialId) ? [initialId] : []);
          }
        }}
      />
      {value !== null && <>
        {retry && <Button variant="ghost" onPress={retry}>{t("common.retry")}</Button>}
        {!gyms && !retry && <Text variant="caption" tone="muted">{t("common.loading")}</Text>}
        {gyms?.length === 0 && <Text variant="caption" tone="muted">{t("gym.noGyms")}</Text>}
        {gyms?.map(gym => {
          const selected = value.includes(gym.id);
          const locked = selected && gym.id === requiredGymId;
          return (
            <Pressable key={gym.id} accessibilityRole="checkbox" disabled={locked} accessibilityState={{ checked: selected, disabled: locked }}
              onPress={() => onChange(selected ? value.filter(id => id !== gym.id) : [...value, gym.id])}
              style={{ flexDirection: "row", alignItems: "center", minHeight: 44, gap: 12 }}>
              <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.lime : colors.muted} />
              <Text style={{ flex: 1 }}>{gym.name}</Text>
            </Pressable>
          );
        })}
      </>}
    </View>
  );
}
