/** Mirrors the live web palette in src/app/globals.css. */
export const colors = {
  background: "#0a0a0c",
  surface: "#151518",
  raised: "#1e1e23",
  line: "#2a2a31",
  text: "#f5f5f7",
  muted: "#98989f",
  faint: "#5c5c64",
  lime: "#d7f651",
  pink: "#f567b5",
  purple: "#622595",
  indigo: "#182788",
  indigoBright: "#4054d6",
  cherry: "#d34f3d",
  cherryBright: "#ff624d",
  flame: "#e04b2e",
  flameText: "#ff7a5c",
  white: "#ffffff",
  black: "#000000",
} as const;

/** Font names registered in apps/mobile/app/_layout.tsx. */
export const fonts = {
  regular: "Urbanist_400Regular",
  medium: "Urbanist_500Medium",
  semibold: "Urbanist_600SemiBold",
  bold: "Urbanist_700Bold",
  dot: "Matricha",
} as const;

export const radii = {
  small: 12,
  medium: 16,
  tile: 20,
  card: 28,
  sheet: 32,
  pill: 999,
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;
