import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, fonts, radii } from "../theme";
import { GradientSurface } from "./gradient-surface";
import { Text } from "./text";

export type ButtonVariant = "lime" | "gradient" | "surface" | "ghost" | "danger";
export type ButtonSize = "sm" | "compact" | "md" | "lg";

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  iconOnly?: boolean;
  dashed?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const heights: Record<ButtonSize, number> = {
  sm: 36,
  compact: 40,
  md: 48,
  lg: 56,
};

const horizontalPadding: Record<ButtonSize, number> = {
  sm: 16,
  compact: 20,
  md: 20,
  lg: 28,
};

const labelSizes: Record<ButtonSize, number> = {
  sm: 14,
  compact: 15,
  md: 15,
  lg: 16,
};

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  lime: { backgroundColor: colors.lime },
  gradient: { backgroundColor: "#42133f" },
  surface: {
    backgroundColor: colors.raised,
    borderColor: colors.line,
    borderWidth: 1,
  },
  ghost: { backgroundColor: "transparent" },
  danger: {
    backgroundColor: "rgba(224,75,46,0.15)",
    borderColor: "rgba(224,75,46,0.3)",
    borderWidth: 1,
  },
};

const labelColors: Record<ButtonVariant, string> = {
  lime: colors.black,
  gradient: colors.white,
  surface: colors.text,
  ghost: colors.muted,
  danger: colors.flameText,
};

export function Button({
  children,
  variant = "surface",
  size = "md",
  loading = false,
  block = false,
  iconOnly = false,
  dashed = false,
  leading,
  trailing,
  disabled,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const unavailable = disabled || loading;
  const height = heights[size];

  return (
    <Pressable
      {...props}
      disabled={unavailable}
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      style={({ pressed }) => [
        {
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          borderRadius: radii.pill,
          height,
          minWidth: iconOnly ? height : undefined,
          paddingHorizontal: iconOnly ? 0 : horizontalPadding[size],
          overflow: "hidden",
          opacity: unavailable ? 0.5 : pressed ? 0.84 : 1,
        },
        variantStyles[variant],
        dashed && { borderStyle: "dashed", borderWidth: 1, borderColor: colors.line },
        block && { alignSelf: "stretch" },
        style,
      ]}
    >
      {variant === "gradient" ? <GradientSurface variant="pink" /> : null}
      {loading ? <ActivityIndicator color={labelColors[variant]} size="small" /> : leading}
      {typeof children === "string" || typeof children === "number" ? (
        <Text
          style={[
            {
              color: labelColors[variant],
              fontFamily: variant === "surface" || variant === "ghost" ? fonts.medium : fonts.semibold,
              fontSize: labelSizes[size],
              lineHeight: labelSizes[size] + 5,
            },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
      {trailing}
    </Pressable>
  );
}
