import { useI18n } from "@/shared/i18n";
import { IconInfo } from "@/shared/ui";

/** Compact help that keeps the guided first-workout flow in context. */
export function FirstWorkoutFormTip() {
  const { t } = useI18n();

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-card border border-lime/20 bg-lime/[0.055] p-4"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime/10 text-lime">
        <IconInfo size={17} />
      </span>
      <p className="text-sm leading-relaxed text-muted">
        {t("firstWorkout.formTip")}
      </p>
    </div>
  );
}
