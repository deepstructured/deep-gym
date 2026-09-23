import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fonts, radii } from "../theme";
import { Text } from "./text";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
}: SegmentedProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radii.pill,
          padding: 4,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.pill,
              paddingHorizontal: 8,
              backgroundColor: active
                ? colors.lime
                : pressed
                  ? "rgba(255,255,255,0.05)"
                  : "transparent",
            })}
          >
            <Text
              numberOfLines={1}
              style={{
                color: active ? colors.black : colors.muted,
                fontFamily: fonts.medium,
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
