import type { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii } from "../theme";
import { Card, GradientCard } from "./card";
import { DotValue } from "./dot-value";
import { Text } from "./text";

export type MetricTileVariant = "surface" | "stat" | "pink" | "indigo" | "cherry";

export interface MetricTileProps {
  label: string;
  value: string | number;
  suffix?: string;
  meta?: string;
  icon?: ReactNode;
  variant?: MetricTileVariant;
  valueColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Compact dashboard card with the live web tile's label/value proportions. */
export function MetricTile({
  label,
  value,
  suffix,
  meta,
  icon,
  variant = "stat",
  valueColor,
  onPress,
  style,
}: MetricTileProps) {
  const cardContent = (
    <>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <Text
          variant="micro"
          tone={variant === "surface" || variant === "stat" ? "muted" : "white"}
          style={{ flex: 1, opacity: variant === "surface" || variant === "stat" ? 1 : 0.62 }}
          numberOfLines={2}
        >
          {label}
        </Text>
        {icon ? (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              backgroundColor: "rgba(255,255,255,0.05)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </View>
        ) : null}
      </View>
      <View>
        <DotValue
          value={value}
          suffix={suffix}
          size={36}
          color={valueColor ?? (variant === "stat" ? colors.lime : colors.white)}
        />
        {meta ? <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>{meta}</Text> : null}
      </View>
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}: ${value}${suffix ? ` ${suffix}` : ""}`}
      style={({ pressed }) => [
        { minHeight: 174, flex: 1, opacity: pressed ? 0.87 : 1 },
        style,
      ]}
    >
      {variant === "surface" || variant === "stat" ? (
        <Card
          variant={variant}
          radius={radii.tile}
          padding={14}
          style={{ flex: 1 }}
          contentStyle={{ justifyContent: "space-between" }}
        >
          {cardContent}
        </Card>
      ) : (
        <GradientCard
          variant={variant}
          radius={radii.tile}
          padding={14}
          style={{ flex: 1 }}
          contentStyle={{ justifyContent: "space-between" }}
        >
          {cardContent}
        </GradientCard>
      )}
    </Pressable>
  );
}
