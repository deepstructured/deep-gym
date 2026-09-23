import { addDays, format, isSameMonth, isSameYear } from "date-fns";
import { enUS, ru, uk } from "date-fns/locale";
import type { WeekBucket } from "./analytics";
import { fromISODate } from "./dates";
import { translateCount, type Lang } from "./i18n";
import { kgToUnit, roundWeight, type Unit } from "./weight";

export type WeeklyActivityMetric = "workouts" | "sets" | "volumeKg";

const dateLocales = { en: enUS, ru, uk } as const;
const numberLocales = { en: "en-US", ru: "ru-RU", uk: "uk-UA" } as const;

/** A bucket always starts on Monday and includes the following Sunday. */
export function formatWeeklyActivityRange(startISO: string, lang: Lang): string {
  const start = fromISODate(startISO);
  const end = addDays(start, 6);
  const locale = dateLocales[lang];
  const sameYear = isSameYear(start, end);
  if (!sameYear) {
    const pattern = lang === "en" ? "MMM d, yyyy" : "d MMM yyyy";
    return `${format(start, pattern, { locale })} – ${format(end, pattern, { locale })}`;
  }
  if (isSameMonth(start, end)) {
    return lang === "en"
      ? `${format(start, "MMM d", { locale })}–${format(end, "d, yyyy", { locale })}`
      : `${format(start, "d", { locale })}–${format(end, "d MMM yyyy", { locale })}`;
  }
  const pattern = lang === "en" ? "MMM d" : "d MMM";
  const endPattern = lang === "en" ? "MMM d, yyyy" : "d MMM yyyy";
  return `${format(start, pattern, { locale })} – ${format(end, endPattern, { locale })}`;
}

/** Date on the chart axis; the full Monday–Sunday range is shown above it. */
export function formatWeeklyActivityAxis(startISO: string, lang: Lang): string {
  const locale = dateLocales[lang];
  return format(fromISODate(startISO), lang === "en" ? "MMM d" : "d MMM", { locale });
}

export function weeklyActivityValue(bucket: WeekBucket, metric: WeeklyActivityMetric): number {
  return bucket[metric];
}

/** Use an exact value in the selected-week readout, including the display unit. */
export function formatWeeklyActivityValue(
  bucket: WeekBucket,
  metric: WeeklyActivityMetric,
  unit: Unit,
  lang: Lang,
): string {
  if (metric === "workouts") return translateCount(lang, "count.workouts", bucket.workouts);
  if (metric === "sets") return translateCount(lang, "count.sets", bucket.sets);
  const volume = roundWeight(kgToUnit(bucket.volumeKg, unit));
  return `${new Intl.NumberFormat(numberLocales[lang], { maximumFractionDigits: 1 }).format(volume)} ${unit}`;
}
