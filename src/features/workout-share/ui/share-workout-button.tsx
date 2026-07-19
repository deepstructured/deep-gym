"use client";

import { useEffect, useState } from "react";
import type { Workout } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import type { Unit } from "@/shared/lib/weight";
import { Button, ErrorNote, IconShare, Sheet } from "@/shared/ui";
import { renderWorkoutSticker } from "../model/render-sticker";
import styles from "./share-workout-button.module.scss";

interface ShareWorkoutButtonProps {
  workout: Workout;
  unit: Unit;
}

/**
 * "Share workout" → renders a transparent PNG sticker (type + volume on a
 * lime card), previews it in a sheet and hands it to the native share sheet
 * via the Web Share API; falls back to a plain download where files can't
 * be shared. Paste it onto a photo as an Instagram story sticker.
 */
export function ShareWorkoutButton({ workout, unit }: ShareWorkoutButtonProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const blob = await renderWorkoutSticker(workout, unit, {
        brand: "DEEPGYM",
        volume: t("stats.volume"),
      });
      setImage({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const fileName = `deepgym-sticker-${workout.date}.png`;

  function download() {
    if (!image) return;
    const link = document.createElement("a");
    link.href = image.url;
    link.download = fileName;
    link.click();
  }

  async function share() {
    if (!image) return;
    const file = new File([image.blob], fileName, { type: "image/png" });
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file] });
      } catch {
        // user dismissed the native sheet — nothing to do
      }
    } else {
      download();
    }
  }

  return (
    <>
      <Button
        variant="surface"
        size="lg"
        block
        onClick={generate}
        loading={busy}
      >
        <IconShare size={18} />
        {t("share.workout")}
      </Button>

      {error && <ErrorNote message={error} />}

      <Sheet
        open={image != null}
        onClose={() => setImage(null)}
        title={t("share.workout")}
      >
        {image && (
          <div className={styles.body}>
            <img
              src={image.url}
              alt={t("share.workout")}
              className={styles.preview}
            />
            <Button variant="lime" size="lg" block onClick={share}>
              {t("share.share")}
            </Button>
            <Button variant="surface" block onClick={download}>
              {t("share.download")}
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
