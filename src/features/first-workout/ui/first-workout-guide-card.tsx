import Link from "next/link";
import { useI18n } from "@/shared/i18n";
import {
  Card,
  IconChevronRight,
  IconDumbbell,
} from "@/shared/ui";

const STEP_KEYS = [
  "firstWorkout.stepType",
  "firstWorkout.stepExercise",
  "firstWorkout.stepSave",
] as const;

/** Contextual guide shown until the athlete logs their first workout. */
export function FirstWorkoutGuideCard() {
  const { t } = useI18n();

  return (
    <Card
      variant="surface"
      className="border border-lime/20 bg-lime/[0.035] p-5"
    >
      <div className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-lime/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-lime/25 bg-lime/10 text-lime">
            <IconDumbbell size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold">
              {t("firstWorkout.guideTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {t("firstWorkout.guideBody")}
            </p>
          </div>
        </div>

        <ol className="mt-5 space-y-3">
          {STEP_KEYS.map((key, index) => (
            <li key={key} className="flex items-center gap-3 text-sm">
              <span className="font-dot flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/6 text-[12px] text-lime">
                {index + 1}
              </span>
              <span className="text-text/90">{t(key)}</span>
            </li>
          ))}
        </ol>

        <Link
          href="/workouts/new?first=1"
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime px-5 text-[15px] font-semibold text-black active:brightness-90"
        >
          {t("firstWorkout.open")}
          <IconChevronRight size={17} />
        </Link>
      </div>
    </Card>
  );
}
