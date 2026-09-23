import Svg, { Path, Rect } from "react-native-svg";

export type TabIconName = "home" | "history" | "new" | "progress" | "library";

/** The same glyph paths used by the PWA's bottom navigation. */
export function TabIcon({
  name,
  size = 24,
  color,
}: {
  name: TabIconName;
  size?: number;
  color: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "home" ? (
        <>
          <Path d="M3 10.5L12 3l9 7.5" />
          <Path d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" />
        </>
      ) : name === "history" ? (
        <>
          <Path d="M3 12a9 9 0 109-9 9.5 9.5 0 00-6.5 2.7L3 8" />
          <Path d="M3 3v5h5" />
          <Path d="M12 7v5l3 3" />
        </>
      ) : name === "new" ? (
        <Path d="M12 5v14M5 12h14" />
      ) : name === "progress" ? (
        <>
          <Path d="M4 4v15a1 1 0 001 1h15" />
          <Path d="M8 15l3.5-4 3 2.5L20 7" />
        </>
      ) : (
        <>
          <Rect x="3.5" y="4" width="5" height="16" rx="1.5" />
          <Rect x="10.5" y="4" width="5" height="16" rx="1.5" />
          <Path d="M17.6 5.2l3 14.3" />
        </>
      )}
    </Svg>
  );
}
