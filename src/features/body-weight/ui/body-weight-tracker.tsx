"use client";

import { useEffect, useRef, useState } from "react";
import {
  useLogBodyWeight,
  type BodyWeightMeasurement,
  type BodyWeightSource,
} from "@/entities/body-weight";
import { useProfile } from "@/entities/user";
import { useI18n } from "@/shared/i18n";
import {
  kgToUnit,
  parseWeight,
  roundWeight,
  unitToKg,
} from "@/shared/lib/weight";
import { Button, Card, DotValue, ErrorNote, Field, Input } from "@/shared/ui";
import styles from "./body-weight.module.scss";

export interface BodyWeightTrackerProps {
  source?: BodyWeightSource;
  /** Fixed measurement timestamp supplied by a host such as WorkoutForm. */
  measuredAt?: string;
  /** Let the athlete choose a timestamp. Ignored when measuredAt is supplied. */
  allowTimestampEdit?: boolean;
  /** Host-provided snapshot, useful when logging a backdated workout. */
  initialWeightKg?: number | null;
  onLogged?: (measurement: BodyWeightMeasurement) => void;
  onPendingChange?: (pending: boolean) => void;
  className?: string;
}

function toLocalDateTimeInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoTimestamp(value: string): string | null {
  // A workout supplies yyyy-MM-dd. Interpret that as local midday so users in
  // negative UTC offsets do not accidentally record the previous calendar day.
  // Today's workout uses the actual current time: local noon may still be in
  // the future during a morning session and the database correctly rejects it.
  const now = new Date();
  const localToday = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value === localToday
      ? now.toISOString()
      : `${value}T12:00:00`
    : value;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** Reusable recorder for Settings and the new-workout footer. It writes via
 * the atomic history+profile-cache RPC and never mutates workout sets. */
export function BodyWeightTracker({
  source = "settings",
  measuredAt,
  allowTimestampEdit = false,
  initialWeightKg,
  onLogged,
  onPendingChange,
  className,
}: BodyWeightTrackerProps) {
  const { t } = useI18n();
  const { data: profile } = useProfile();
  const logWeight = useLogBodyWeight();
  const unit = profile?.unit ?? "kg";

  const [value, setValue] = useState("");
  const [timestamp, setTimestamp] = useState(() =>
    toLocalDateTimeInput(new Date()),
  );
  const editedValue = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    onPendingChange?.(logWeight.isPending);
  }, [logWeight.isPending, onPendingChange]);

  useEffect(() => {
    if (editedValue.current) return;
    const sourceWeight =
      initialWeightKg !== undefined
        ? initialWeightKg
        : profile?.body_weight_kg;
    setValue(
      sourceWeight != null
        ? String(roundWeight(kgToUnit(sourceWeight, unit)))
        : "",
    );
  }, [initialWeightKg, profile?.body_weight_kg, unit]);

  function submit() {
    setSaved(false);
    setError(null);

    const parsed = parseWeight(value);
    if (parsed == null) {
      setError(t("bodyWeight.invalid"));
      return;
    }

    const effectiveTimestamp = measuredAt
      ? toIsoTimestamp(measuredAt)
      : allowTimestampEdit
        ? toIsoTimestamp(timestamp)
        : new Date().toISOString();
    if (
      !effectiveTimestamp ||
      new Date(effectiveTimestamp).getTime() > Date.now() + 5 * 60_000
    ) {
      setError(t("bodyWeight.invalidTimestamp"));
      return;
    }

    logWeight.mutate(
      {
        weightKg: Math.round(unitToKg(parsed, unit) * 1000) / 1000,
        measuredAt: effectiveTimestamp,
        source,
      },
      {
        onSuccess: (measurement) => {
          editedValue.current = false;
          setSaved(true);
          onLogged?.(measurement);
        },
        onError: () => setError(t("common.error")),
      },
    );
  }

  return (
    <Card variant="surface" className={`${styles.tracker} ${className ?? ""}`}>
      <div className={styles.headingRow}>
        <div>
          <p className={styles.title}>{t("bodyWeight.title")}</p>
          <p className={styles.hint}>{t("bodyWeight.trackerHint")}</p>
        </div>
        <div className={styles.current}>
          <span className={styles.currentLabel}>{t("bodyWeight.current")}</span>
          <DotValue
            value={
              profile?.body_weight_kg != null
                ? roundWeight(kgToUnit(profile.body_weight_kg, unit))
                : "—"
            }
            suffix={profile?.body_weight_kg != null ? unit : undefined}
            className={styles.currentValue}
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <Field label={t("bodyWeight.inputLabel", { unit })} className={styles.weightField}>
          <Input
            value={value}
            onChange={(event) => {
              editedValue.current = true;
              setSaved(false);
              setValue(event.target.value.replace(/[^\d.,]/g, ""));
            }}
            inputMode="decimal"
            placeholder="80"
          />
        </Field>
        <Button
          type="button"
          variant="lime"
          onClick={submit}
          loading={logWeight.isPending}
          className={styles.saveButton}
        >
          {t("bodyWeight.record")}
        </Button>
      </div>

      {!measuredAt && allowTimestampEdit && (
        <Field label={t("bodyWeight.measuredAt")}>
          <Input
            type="datetime-local"
            value={timestamp}
            max={toLocalDateTimeInput(new Date())}
            onChange={(event) => {
              setSaved(false);
              setTimestamp(event.target.value);
            }}
          />
        </Field>
      )}

      {saved && <p className={styles.success}>{t("bodyWeight.saved")}</p>}
      {error && <ErrorNote message={error} />}
    </Card>
  );
}
