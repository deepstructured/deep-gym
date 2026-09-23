import type { ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, fonts, radii } from "../theme";
import { Text } from "./text";

export interface ChipProps extends Omit<PressableProps, "children" | "style"> {
  children: ReactNode;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ children, selected = false, disabled, style, ...props }: ChipProps) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        {
          alignSelf: "flex-start",
          minHeight: 36,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radii.pill,
          borderWidth: selected ? 0 : 1,
          borderColor: colors.line,
          backgroundColor: selected ? colors.lime : pressed ? "#24242a" : colors.raised,
          paddingHorizontal: 16,
          opacity: disabled ? 0.38 : 1,
        },
        style,
      ]}
    >
      {typeof children === "string" || typeof children === "number" ? (
        <Text
          style={{
            color: selected ? colors.black : colors.muted,
            fontFamily: fonts.medium,
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
