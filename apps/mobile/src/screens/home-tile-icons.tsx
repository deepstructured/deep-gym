import Svg, { Circle, Path, Rect } from "react-native-svg";
import { View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { colors } from "../theme";
import { Text } from "../ui";

export type TileIconName = "dumbbell" | "flame" | "history" | "target" | "calendar" |
  "scale" | "trophy" | "repeat" | "chart" | "template" | "plus" | "chevron" | "widgets" | "play";

/** The dashboard icons use the same 24px paths as the PWA icon set. */
export function HomeTileIcon({ name, size = 16, color = "#fff" }: {
  name: TileIconName;
  size?: number;
  color?: string;
}) {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let content;
  switch (name) {
    case "dumbbell": content = <>
      <Path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" {...stroke} />
    </>; break;
    case "flame": content = <Path d="M12 21c4 0 6.5-2.6 6.5-6.2 0-2.5-1.4-4.6-2.9-6.3-.6 1-1.3 1.7-2.1 2.1C13.4 8.5 13 5.5 10.5 3c-.3 2.4-1.2 4-2.6 5.6C6.5 10.2 5.5 12 5.5 14.8 5.5 18.4 8 21 12 21z" {...stroke} />; break;
    case "history": content = <Path d="M3 12a9 9 0 109-9 9.5 9.5 0 00-6.5 2.7L3 8M3 3v5h5M12 7v5l3 3" {...stroke} />; break;
    case "target": content = <>
      <Circle cx="12" cy="12" r="8.5" {...stroke} />
      <Circle cx="12" cy="12" r="4.5" {...stroke} />
      <Circle cx="12" cy="12" r="0.8" fill={color} />
    </>; break;
    case "calendar": content = <>
      <Rect x="3" y="5" width="18" height="16" rx="3" {...stroke} />
      <Path d="M8 3v4M16 3v4M3 10h18" {...stroke} />
    </>; break;
    case "scale": content = <>
      <Rect x="3.5" y="3.5" width="17" height="17" rx="4" {...stroke} />
      <Path d="M8 9a5 5 0 018 0M12 9.5l1.4-2" {...stroke} />
    </>; break;
    case "trophy": content = <>
      <Path d="M8 4h8v5a4 4 0 01-8 0V4zM8 6H5a2.5 2.5 0 003 4M16 6h3a2.5 2.5 0 01-3 4M12 13v4M8.5 20.5h7M9.5 17h5" {...stroke} />
    </>; break;
    case "repeat": content = <Path d="M17 3l3 3-3 3M4 11V9a3 3 0 013-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 01-3 3H4" {...stroke} />; break;
    case "chart": content = <Path d="M4 4v15a1 1 0 001 1h15M8 15l3.5-4 3 2.5L20 7" {...stroke} />; break;
    case "template": content = <>
      <Rect x="4" y="3.5" width="16" height="6" rx="2" {...stroke} />
      <Rect x="4" y="13" width="7" height="7.5" rx="2" {...stroke} />
      <Rect x="14" y="13" width="6" height="7.5" rx="2" {...stroke} />
    </>; break;
    case "widgets": content = <>
      <Rect x="3.5" y="3.5" width="7" height="7" rx="2" {...stroke} />
      <Rect x="13.5" y="3.5" width="7" height="7" rx="2" {...stroke} />
      <Rect x="3.5" y="13.5" width="17" height="7" rx="2" {...stroke} />
    </>; break;
    case "plus": content = <Path d="M12 5v14M5 12h14" {...stroke} />; break;
    case "play": content = <Path d="M8 5.5v13l10-6.5L8 5.5z" fill={color} />; break;
    case "chevron": content = <Path d="M9 18l6-6-6-6" {...stroke} />; break;
  }
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">{content}</Svg>;
}

export function HomeTileHead({ label, icon, tone = "white", action, style }: {
  label: string;
  icon?: TileIconName;
  tone?: "white" | "lime" | "indigo";
  action?: ReactNode;
  style?: ViewStyle;
}) {
  const iconColor = tone === "lime" ? colors.lime : tone === "indigo" ? "#aeb8ff" : "rgba(255,255,255,0.75)";
  return <View style={[{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }, style]}>
    <Text variant="micro" tone="muted" style={{ flex: 1, letterSpacing: 1.25, textTransform: "uppercase" }}>{label}</Text>
    {action}
    {icon ? <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: tone === "lime" ? "rgba(215,246,81,0.2)" : "rgba(255,255,255,0.1)",
      backgroundColor: tone === "lime" ? "rgba(215,246,81,0.1)" : "rgba(255,255,255,0.05)" }}>
      <HomeTileIcon name={icon} size={15} color={iconColor} />
    </View> : null}
  </View>;
}
