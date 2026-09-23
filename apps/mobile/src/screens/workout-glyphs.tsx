import Svg, { Circle, Path } from "react-native-svg";

export type WorkoutGlyphName = "info" | "compare" | "note" | "trash" | "flame" | "plates" | "template";

export function WorkoutGlyph({ name, size = 18, color }: { name: WorkoutGlyphName; size?: number; color: string }) {
  const lines = {
    fill: "none" as const,
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...lines}>
      {name === "info" ? (
        <>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 11v5M12 8h.01" />
        </>
      ) : name === "compare" ? (
        <Path d="M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3" />
      ) : name === "note" ? (
        <Path d="M5 4a1 1 0 011-1h9l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4zM15 3v5h5M9 13h6M9 17h4" />
      ) : name === "trash" ? (
        <Path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" />
      ) : name === "flame" ? (
        <Path d="M12 21c4 0 6.5-2.6 6.5-6.2 0-2.5-1.4-4.6-2.9-6.3-.6 1-1.3 1.7-2.1 2.1C13.4 8.5 13 5.5 10.5 3c-.3 2.4-1.2 4-2.6 5.6C6.5 10.2 5.5 12 5.5 14.8 5.5 18.4 8 21 12 21z" />
      ) : name === "template" ? (
        <Path d="M4 6a3 3 0 013-3h10a3 3 0 013 3v12a3 3 0 01-3 3H7a3 3 0 01-3-3V6zM8 8h8M8 12h8M8 16h5" />
      ) : (
        <>
          <Circle cx="12" cy="12" r="8.5" />
          <Circle cx="12" cy="12" r="4" />
          <Circle cx="12" cy="12" r="0.8" fill={color} stroke="none" />
        </>
      )}
    </Svg>
  );
}
