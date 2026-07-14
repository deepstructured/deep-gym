"use client";

import { useEffect, useState } from "react";
import { useExercises, useUpdateExercise } from "@/entities/exercise";
import { useI18n } from "@/shared/i18n";
import { Button, IconInfo, Sheet, TextArea } from "@/shared/ui";

interface MachineInfoButtonProps {
  exerciseId: string;
  exerciseName: string;
  machineSettings: string | null;
  /** Rendered on gradient cards — lighter button style. */
  onGradient?: boolean;
}

/**
 * The ⓘ button next to machine exercises: opens a sheet with your saved
 * machine setup (seat height, handle position, …) and lets you edit it.
 */
export function MachineInfoButton({
  exerciseId,
  exerciseName,
  machineSettings,
  onGradient,
}: MachineInfoButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const update = useUpdateExercise();

  // The prop can be a stale snapshot (the workout draft copies the exercise
  // when it's added) — prefer the live value from the exercises cache so a
  // setup saved here is visible the next time the sheet opens.
  const { data: exercises } = useExercises();
  const live = exercises?.find((e) => e.id === exerciseId);
  const currentSettings = live ? live.machine_settings : machineSettings;

  const [text, setText] = useState(currentSettings ?? "");

  useEffect(() => {
    setText(currentSettings ?? "");
  }, [currentSettings]);

  function save() {
    update.mutate(
      { id: exerciseId, patch: { machine_settings: text.trim() || null } },
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("machine.title")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          onGradient
            ? "flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white"
            : "flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-lime"
        }
      >
        <IconInfo size={17} />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("machine.title")}
      >
        <p className="mb-3 text-sm text-muted">{exerciseName}</p>
        {editing ? (
          <div className="space-y-4">
            <TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder={t("machine.placeholder")}
              autoFocus
            />
            <div className="flex gap-3">
              <Button
                variant="surface"
                className="flex-1"
                onClick={() => {
                  setEditing(false);
                  setText(currentSettings ?? "");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="lime"
                className="flex-1"
                onClick={save}
                loading={update.isPending}
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-tile border border-line bg-raised px-4 py-4 whitespace-pre-wrap text-[15px] leading-relaxed">
              {currentSettings || (
                <span className="text-faint">{t("machine.empty")}</span>
              )}
            </div>
            <Button
              variant="surface"
              className="w-full"
              onClick={() => setEditing(true)}
            >
              {currentSettings ? t("machine.edit") : t("machine.add")}
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
