import { PRESET_AVATARS } from "@deepgym/core/avatar-presets";
import type { ImageSourcePropType } from "react-native";

const PRESET_IMAGES: Record<(typeof PRESET_AVATARS)[number]["id"], ImageSourcePropType> = {
  portal: require("../../assets/avatars/deepgym-pixel-portal.webp"),
  shark: require("../../assets/avatars/deepgym-pixel-shark.webp"),
  mountain: require("../../assets/avatars/deepgym-pixel-mountain.webp"),
  lifter: require("../../assets/avatars/deepgym-pixel-lifter.webp"),
  gorilla: require("../../assets/avatars/deepgym-pixel-gorilla.webp"),
  raven: require("../../assets/avatars/deepgym-pixel-raven.webp"),
  eclipse: require("../../assets/avatars/deepgym-pixel-eclipse.webp"),
  barbell: require("../../assets/avatars/deepgym-pixel-barbell.webp"),
  grip: require("../../assets/avatars/deepgym-pixel-grip.webp"),
  pulse: require("../../assets/avatars/deepgym-pixel-pulse.webp"),
};

export function avatarSource(url: string | null): ImageSourcePropType {
  const preset = PRESET_AVATARS.find((entry) => entry.url === url);
  if (preset) return PRESET_IMAGES[preset.id];
  // React Native's Image does not decode the legacy SVG profile URLs.
  if (url?.split("?")[0].endsWith(".svg")) return PRESET_IMAGES.portal;
  if (url) {
    const webBase = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "") ?? "";
    if (url.startsWith("http") || webBase) {
      return { uri: url.startsWith("http") ? url : `${webBase}${url}` };
    }
  }
  return PRESET_IMAGES.portal;
}
