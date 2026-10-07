import type { Lang } from "@/shared/i18n";

/** Updated by scripts/take-screenshots.mjs to invalidate old image caches. */
export const SCREENSHOT_REVISION = "20261007140341287";

export type ScreenshotName = "home" | "new-workout" | "progress" | "history" | "templates" | "exercise-detail";

export function screenshotPath(name: ScreenshotName, locale: Lang = "en") {
  const directory = locale === "en" ? "" : `${locale}/`;
  return `/screenshots/${directory}${name}.webp?v=${SCREENSHOT_REVISION}`;
}
