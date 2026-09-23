import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { colors } from "../theme";
import { Text } from "../ui";
import { useI18n } from "../providers/locale-provider";
import { WorkoutGlyph, type WorkoutGlyphName } from "./workout-glyphs";

interface WorkoutExerciseHeaderProps {
  dragHandle: ReactNode;
  name: string;
  muscleGroupName: string;
  machine: boolean;
  noteActive: boolean;
  onMachine: () => void;
  onCompare: () => void;
  onNote: () => void;
  onRemove: () => void;
}

/** Same single-line hierarchy as the PWA exercise editor. */
export function WorkoutExerciseHeader({
  dragHandle,
  name,
  muscleGroupName,
  machine,
  noteActive,
  onMachine,
  onCompare,
  onNote,
  onRemove,
}: WorkoutExerciseHeaderProps) {
  const { t } = useI18n();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 15 }}>
      {dragHandle}
      <View style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <Text weight="semibold" style={{ fontSize: 16, lineHeight: 21 }} numberOfLines={1}>{name}</Text>
        {muscleGroupName ? (
          <View style={{ alignSelf: "flex-start", minHeight: 24, paddingHorizontal: 10, marginTop: 5, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.raised, justifyContent: "center" }}>
            <Text variant="caption" weight="medium" tone="muted">{muscleGroupName}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 1 }}>
        {machine ? <ActionGlyph name="info" label={t("machine.title")} color={colors.lime} onPress={onMachine} /> : null}
        <ActionGlyph name="compare" label={t("compare.aria")} onPress={onCompare} />
        <ActionGlyph name="note" label={t("exercise.note")} color={noteActive ? colors.lime : colors.muted} onPress={onNote} />
        <ActionGlyph name="trash" label={t("exercise.remove")} onPress={onRemove} />
      </View>
    </View>
  );
}

function ActionGlyph({ name, label, color = colors.muted, onPress }: { name: WorkoutGlyphName; label: string; color?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised }}
    >
      <WorkoutGlyph name={name} size={17} color={color} />
    </Pressable>
  );
}
