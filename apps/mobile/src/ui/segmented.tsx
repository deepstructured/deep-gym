import NativeSegmentedControl from "@react-native-segmented-control/segmented-control";
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
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
  // UIKit owns the selection gesture on iOS. The old animated imitation could
  // detach its thumb from the selected label while a parent layout changed.
  // Its title colors can still be overridden by the system appearance during
  // the thumb animation, so visible labels are rendered above the native ones.
  if (Platform.OS === "ios") {
    return (
      <View style={[{
        backgroundColor: colors.surface,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.line,
        overflow: "hidden",
        padding: 2,
      }, style]}>
        <NativeSegmentedControl
          accessibilityLabel={accessibilityLabel}
          values={options.map((option) => option.label)}
          selectedIndex={options.findIndex((option) => option.value === value)}
          onChange={(event) => {
            const next = options[event.nativeEvent.selectedSegmentIndex];
            if (next && next.value !== value) onChange(next.value);
          }}
          appearance="dark"
          tintColor={colors.lime}
          backgroundColor={colors.surface}
          fontStyle={{ color: "transparent", fontFamily: fonts.medium, fontSize: 14 }}
          activeFontStyle={{ color: "transparent", fontFamily: fonts.medium, fontSize: 14 }}
          style={{ height: 48, width: "100%" }}
        />
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", top: 3, right: 3, bottom: 3, left: 3, flexDirection: "row" }}>
          {options.map((option) => (
            <View key={option.value} style={{ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
              <Text numberOfLines={1} style={{ color: option.value === value ? colors.black : colors.muted, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 }}>
                {option.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

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
