import type { ReactNode } from "react";
import { View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "../theme";
import { GradientSurface, WellSurface, type GradientVariant } from "./gradient-surface";

export type CardVariant = "surface" | "raised" | "stat" | "live" | "explorer";

export interface CardProps extends Omit<ViewProps, "children" | "style"> {
  children: ReactNode;
  variant?: CardVariant;
  radius?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

const surfaceStyles: Record<CardVariant, ViewStyle> = {
  surface: {
    backgroundColor: colors.surface,
    borderColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
  },
  raised: {
    backgroundColor: colors.raised,
    borderColor: colors.line,
    borderWidth: 1,
  },
  stat: {
    backgroundColor: "#111114",
    borderColor: "rgba(255,255,255,0.085)",
    borderWidth: 1,
  },
  live: {
    backgroundColor: colors.surface,
    borderColor: "rgba(215,246,81,0.35)",
    borderWidth: 1,
  },
  explorer: {
    backgroundColor: colors.surface,
    borderColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
  },
};

export function Card({
  children,
  variant = "surface",
  radius = radii.card,
  padding = spacing.lg,
  style,
  contentStyle,
  ...props
}: CardProps) {
  return (
    <View
      {...props}
      style={[
        { borderRadius: radius, overflow: "hidden" },
        surfaceStyles[variant],
        style,
      ]}
    >
      <WellSurface variant={variant} />
      <View style={[{ flexGrow: 1, padding }, contentStyle]}>{children}</View>
    </View>
  );
}

export interface GradientCardProps extends Omit<ViewProps, "children" | "style"> {
  children: ReactNode;
  variant: GradientVariant;
  radius?: number;
  padding?: number;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

const glowColors: Record<GradientVariant, string> = {
  pink: "#f567b5",
  indigo: "#4054d6",
  cherry: "#d34f3d",
  flame: "#e04b2e",
};

const borderColors: Record<GradientVariant, string> = {
  pink: "rgba(255,193,228,0.11)",
  indigo: "rgba(132,151,255,0.1)",
  cherry: "rgba(255,117,91,0.28)",
  flame: "rgba(255,117,91,0.2)",
};

export function GradientCard({
  children,
  variant,
  radius = radii.card,
  padding = spacing.lg,
  glow = true,
  style,
  contentStyle,
  ...props
}: GradientCardProps) {
  return (
    <View
      {...props}
      style={[
        {
          borderRadius: radius,
          backgroundColor: colors.surface,
          shadowColor: glowColors[variant],
          shadowOpacity: glow ? 0.24 : 0,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 12 },
        },
        style,
      ]}
    >
      <View
        style={{
          flexGrow: 1,
          borderRadius: radius,
          overflow: "hidden",
          borderColor: borderColors[variant],
          borderWidth: 1,
        }}
      >
        <GradientSurface variant={variant} />
        <View style={[{ flexGrow: 1, padding }, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}
