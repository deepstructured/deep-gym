import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

export type GradientVariant = "pink" | "indigo" | "cherry" | "flame";

/** Layered SVG fills recreate the radial colour at the edge of the web cards. */
export function GradientSurface({ variant }: { variant: GradientVariant }) {
  if (variant === "pink") {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="base" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#42133f" />
              <Stop offset="54%" stopColor="#27102f" />
              <Stop offset="100%" stopColor="#150b22" />
            </LinearGradient>
            <RadialGradient id="shine" cx="0%" cy="-55%" r="138%">
              <Stop offset="0%" stopColor="#ff97d8" stopOpacity={0.94} />
              <Stop offset="28%" stopColor="#f567b5" stopOpacity={0.68} />
              <Stop offset="55%" stopColor="#722787" stopOpacity={0.38} />
              <Stop offset="80%" stopColor="#722787" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="corner" cx="106%" cy="112%" r="94%">
              <Stop offset="0%" stopColor="#43185b" stopOpacity={0.58} />
              <Stop offset="70%" stopColor="#43185b" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#base)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#shine)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#corner)" />
        </Svg>
      </View>
    );
  }

  if (variant === "indigo") {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="base" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#172263" />
              <Stop offset="58%" stopColor="#0b133f" />
              <Stop offset="100%" stopColor="#070b28" />
            </LinearGradient>
            <RadialGradient id="shine" cx="4%" cy="-72%" r="140%">
              <Stop offset="0%" stopColor="#5c70e5" stopOpacity={0.9} />
              <Stop offset="34%" stopColor="#3243b7" stopOpacity={0.62} />
              <Stop offset="60%" stopColor="#182788" stopOpacity={0.24} />
              <Stop offset="80%" stopColor="#182788" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="corner" cx="104%" cy="112%" r="110%">
              <Stop offset="0%" stopColor="#1f319d" stopOpacity={0.46} />
              <Stop offset="70%" stopColor="#1f319d" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#base)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#shine)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#corner)" />
        </Svg>
      </View>
    );
  }

  if (variant === "cherry") {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="base" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#170c0b" />
              <Stop offset="58%" stopColor="#1b0b09" />
              <Stop offset="100%" stopColor="#72281e" />
            </LinearGradient>
            <RadialGradient id="shine" cx="50%" cy="119%" r="82%">
              <Stop offset="0%" stopColor="#ff654f" />
              <Stop offset="38%" stopColor="#d65343" />
              <Stop offset="76%" stopColor="#72281e" stopOpacity={0.38} />
              <Stop offset="100%" stopColor="#72281e" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="well" cx="50%" cy="34%" r="72%">
              <Stop offset="0%" stopColor="#0a0707" stopOpacity={0.99} />
              <Stop offset="55%" stopColor="#1b0b09" stopOpacity={0.93} />
              <Stop offset="100%" stopColor="#1b0b09" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#base)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#shine)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#well)" />
        </Svg>
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="flame" cx="50%" cy="118%" r="122%">
            <Stop offset="0%" stopColor="#ff6a3d" />
            <Stop offset="30%" stopColor="#e04b2e" />
            <Stop offset="62%" stopColor="#8c2412" />
            <Stop offset="100%" stopColor="#330d05" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#flame)" />
      </Svg>
    </View>
  );
}
