"use client";

import { useEffect, useState } from "react";
import { useExercises, useUpdateExercise } from "@/entities/exercise";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { Button, IconInfo, Sheet, TextArea } from "@/shared/ui";
import styles from "./machine-info.module.scss";

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
        className={cn(
          styles.trigger,
          onGradient && styles.triggerOnGradient,
        )}
      >
        <IconInfo size={17} />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("machine.title")}
      >
        <p className={styles.exerciseName}>{exerciseName}</p>
        {editing ? (
          <div className={styles.stack}>
            <TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder={t("machine.placeholder")}
              autoFocus
            />
            <div className={styles.actions}>
              <Button
                variant="surface"
                grow
                onClick={() => {
                  setEditing(false);
                  setText(currentSettings ?? "");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="lime"
                grow
                onClick={save}
                loading={update.isPending}
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.stack}>
            <div className={styles.settings}>
              {currentSettings || (
                <span className={styles.settingsEmpty}>{t("machine.empty")}</span>
              )}
            </div>
            <Button
              variant="surface"
              block
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
