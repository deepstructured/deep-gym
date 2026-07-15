import { useI18n } from "@/shared/i18n";
import { Button, IconCheck, Sheet } from "@/shared/ui";

interface FirstWorkoutSuccessSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Completion moment after the first workout reaches History. */
export function FirstWorkoutSuccessSheet({
  open,
  onClose,
}: FirstWorkoutSuccessSheetProps) {
  const { t } = useI18n();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("firstWorkout.savedTitle")}
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-lime/25 bg-lime/10 text-lime">
        <IconCheck size={26} />
      </div>
      <p className="text-[15px] leading-relaxed text-muted">
        {t("firstWorkout.savedBody")}
      </p>
      <Button
        type="button"
        variant="lime"
        size="lg"
        className="mt-6 w-full"
        onClick={onClose}
      >
        {t("firstWorkout.openHistory")}
      </Button>
    </Sheet>
  );
}
