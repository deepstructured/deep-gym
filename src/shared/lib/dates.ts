import { format, parseISO, type Locale } from "date-fns";
import { enUS, ru, uk } from "date-fns/locale";
export { fromISODate, toISODate, todayISO } from "../../../packages/core/src/dates";

const DATE_LOCALES = { en: enUS, ru, uk } as const;
export type DateLang = keyof typeof DATE_LOCALES;

// Set by the I18nProvider; every re-render after a language switch
// picks up the new locale.
let currentLang: DateLang = "en";

export function setDateLocale(lang: DateLang) {
  currentLang = lang;
}

export function getDateLocale(): Locale {
  return DATE_LOCALES[currentLang];
}

/** "MMM d" reads backwards in ru/uk — those want "d MMM". */
function dayFirst(): boolean {
  return currentLang !== "en";
}

export function formatDay(iso: string): string {
  return format(parseISO(iso), dayFirst() ? "EEE, d MMM" : "EEE, MMM d", {
    locale: getDateLocale(),
  });
}

export function formatDayFull(iso: string): string {
  return format(parseISO(iso), dayFirst() ? "EEEE, d MMMM" : "EEEE, MMMM d", {
    locale: getDateLocale(),
  });
}

export function formatShort(iso: string): string {
  return format(parseISO(iso), dayFirst() ? "d MMM" : "MMM d", {
    locale: getDateLocale(),
  });
}

export function formatMonthYear(date: Date): string {
  return format(date, "LLLL yyyy", { locale: getDateLocale() });
}

/** Chart date label: "d MMM", or month + year once the range spans ~a year. */
export function formatAxisDate(iso: string, spanDays = 0): string {
  const date = parseISO(iso);
  if (spanDays > 300) {
    return format(date, "LLL yy", { locale: getDateLocale() });
  }
  return format(date, dayFirst() ? "d MMM" : "MMM d", {
    locale: getDateLocale(),
  });
}
