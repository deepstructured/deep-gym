"use client";

import { useMemo, useState } from "react";
import { useExercise } from "@/entities/exercise";
import { useProfile } from "@/entities/user";
import {
  useExerciseHistory,
  type ExerciseSetRecord,
} from "@/entities/workout";
import { subDays } from "date-fns";
import { useI18n } from "@/shared/i18n";
import {
  formatDayFull,
  fromISODate,
  toISODate,
  todayISO,
} from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import {
  kgToUnit,
  parseSignedWeight,
  roundWeight,
  unitToKg,
  type Unit,
} from "@/shared/lib/weight";
import {
  Calendar,
  EmptyState,
  IconCalendar,
  IconChevronDown,
  IconCompare,
  IconFlame,
  Sheet,
  Spinner,
} from "@/shared/ui";
import styles from "./compare-button.module.scss";

interface BodyweightChipValues {
  base: string;
  added: string;
  total: string;
  unit: Unit;
}

interface SetChipValue {
  weight: string;
  reps: string;
  toFailure: boolean;
  bodyweight?: BodyweightChipValues;
}

function displayWeight(weightKg: number, unit: Unit): string {
  return String(roundWeight(kgToUnit(weightKg, unit)));
}

function displaySignedWeight(weightKg: number, unit: Unit): string {
  const value = roundWeight(kgToUnit(weightKg, unit));
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized >= 0 ? `+${normalized}` : String(normalized);
}

function bodyweightChip(
  totalWeightKg: number,
  bodyWeightKg: number,
  unit: Unit,
): BodyweightChipValues {
  return {
    base: displayWeight(bodyWeightKg, unit),
    added: displaySignedWeight(totalWeightKg - bodyWeightKg, unit),
    total: displayWeight(totalWeightKg, unit),
    unit,
  };
}

/** Minimal shape of the sets being logged right now, in the display unit. */
export interface CompareCurrentSet {
  weight: string;
  /** Bodyweight drafts keep this signed load separately from total weight. */
  addedWeight?: string;
  reps: string;
  toFailure: boolean;
}

interface CompareButtonProps {
  exerciseId: string;
  exerciseName: string;
  unit: Unit;
  /** Sets entered in the current draft, for the side-by-side reference. */
  currentSets: CompareCurrentSet[];
  /** Canonical snapshot for the current draft. When omitted, today's profile
   * cache is used as a conservative fallback; null explicitly means absent. */
  currentBodyWeightKg?: number | null;
  /** The draft workout's date (ISO). Only sessions strictly before it are
   *  offered for comparison — so editing a past workout compares it against
   *  its own past, not against itself or later sessions. */
  currentDate: string;
}

/**
 * The ⇄ button next to an exercise: opens a sheet that shows the sets logged
 * for this exercise on a past day, picked from a calendar of prior sessions.
 */
export function CompareButton(props: CompareButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={t("compare.aria")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={styles.trigger}
      >
        <IconCompare size={16} />
      </button>
      {open && (
        <CompareSheet {...props} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function CompareSheet({
  exerciseId,
  exerciseName,
  unit,
  currentSets,
  currentBodyWeightKg: draftBodyWeightKg,
  currentDate,
  onClose,
}: CompareButtonProps & { onClose: () => void }) {
  const { t } = useI18n();
  const { data: history, isLoading } = useExerciseHistory(exerciseId);
  const { data: exercise } = useExercise(exerciseId);
  const { data: profile } = useProfile();
  const isBodyweight = exercise?.equipment === "bodyweight";
  const currentBodyWeightKg = isBodyweight
    ? draftBodyWeightKg !== undefined
      ? draftBodyWeightKg
      : currentDate === todayISO()
        ? profile?.body_weight_kg ?? null
        : null
    : null;

  /** date (ISO) → sets logged that day, sorted by set order.
   *  Only days before the draft's date qualify as "past". */
  const sessions = useMemo(() => {
    const byDate = new Map<string, ExerciseSetRecord[]>();
    for (const record of history ?? []) {
      if (record.workoutDate >= currentDate) continue;
      const list = byDate.get(record.workoutDate) ?? [];
      list.push(record);
      byDate.set(record.workoutDate, list);
    }
    for (const list of byDate.values()) {
      list.sort((a, b) => a.position - b.position);
    }
    return byDate;
  }, [history, currentDate]);

  const markedDates = useMemo(() => new Set(sessions.keys()), [sessions]);
  const latestDate = useMemo(
    () => [...sessions.keys()].sort().at(-1) ?? null,
    [sessions],
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // default to the most recent past session once history has loaded
  const activeDate = selected ?? latestDate;
  const selectedSets = activeDate ? sessions.get(activeDate) : undefined;
  const selectedNotes = selectedSets?.find((s) => s.exerciseNotes)?.exerciseNotes;

  const filledCurrent = currentSets.filter(
    (s) => s.weight.trim() || s.addedWeight?.trim() || s.reps.trim(),
  );

  return (
    <Sheet open onClose={onClose} title={t("compare.title")}>
      <p className={styles.exerciseName}>{exerciseName}</p>

      {isLoading ? (
        <div className={styles.loading}>
          <Spinner size={24} />
        </div>
      ) : markedDates.size === 0 ? (
        <EmptyState
          title={t("compare.emptyTitle")}
          hint={t("compare.emptyHint")}
        />
      ) : (
        <div className={styles.stack}>
          {/* This session, for reference — a past workout shows its date */}
          {filledCurrent.length > 0 && (
            <div>
              <p className={styles.sectionLabel}>
                {currentDate === todayISO()
                  ? t("compare.thisSession")
                  : formatDayFull(currentDate)}
              </p>
              <SetChips
                sets={filledCurrent.map((s) => {
                  const totalDisplay = Number(
                    s.weight.trim().replace(",", "."),
                  );
                  const totalWeightKg =
                    Number.isFinite(totalDisplay) && totalDisplay > 0
                      ? unitToKg(totalDisplay, unit)
                      : null;
                  const addedDisplay = parseSignedWeight(s.addedWeight ?? "");
                  const profileMatchesDraft =
                    currentBodyWeightKg != null &&
                    totalWeightKg != null &&
                    addedDisplay != null &&
                    Math.abs(
                      currentBodyWeightKg +
                        unitToKg(addedDisplay, unit) -
                        totalWeightKg,
                    ) < 0.06;

                  return {
                    weight: s.weight.trim() || "—",
                    reps: s.reps.trim() || "—",
                    toFailure: s.toFailure,
                    bodyweight:
                      profileMatchesDraft
                        ? bodyweightChip(
                            totalWeightKg!,
                            currentBodyWeightKg!,
                            unit,
                          )
                        : undefined,
                  };
                })}
              />
            </div>
          )}

          {/* Day picker */}
          <button
            type="button"
            onClick={() => setShowCalendar((v) => !v)}
            className={styles.dayPicker}
          >
            <IconCalendar size={18} className={styles.dayPickerIcon} />
            <span className={styles.dayPickerLabel}>
              {activeDate ? formatDayFull(activeDate) : t("compare.pickDay")}
            </span>
            <IconChevronDown
              size={18}
              className={cn(styles.chevron, showCalendar && styles.chevronOpen)}
            />
          </button>

          {showCalendar && (
            <Calendar
              value={activeDate}
              markedDates={markedDates}
              maxDate={toISODate(subDays(fromISODate(currentDate), 1))}
              onChange={(iso) => {
                setSelected(iso);
                setShowCalendar(false);
              }}
              className={styles.calendar}
            />
          )}

          {/* Selected day's sets */}
          <div>
            <p className={styles.sectionLabel}>
              {activeDate ? formatDayFull(activeDate) : t("compare.selectedDay")}
            </p>
            {selectedSets && selectedSets.length > 0 ? (
              <>
                <SetChips
                  sets={selectedSets.map((s) => {
                    const bodyWeightKg = s.body_weight_kg;
                    return {
                      weight:
                        s.weight_kg != null
                          ? String(roundWeight(kgToUnit(s.weight_kg, unit)))
                          : "—",
                      reps: s.reps != null ? String(s.reps) : "—",
                      toFailure: s.to_failure,
                      bodyweight:
                        isBodyweight &&
                        bodyWeightKg != null &&
                        s.weight_kg != null
                          ? bodyweightChip(s.weight_kg, bodyWeightKg, unit)
                          : undefined,
                    };
                  })}
                />
                {selectedNotes && (
                  <p className={styles.dayNotes}>
                    {selectedNotes}
                  </p>
                )}
              </>
            ) : (
              <p className={styles.noSets}>
                {t("compare.noSets")}
              </p>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function SetChips({
  sets,
}: {
  sets: SetChipValue[];
}) {
  return (
    <div className={styles.chips}>
      {sets.map((set, i) => (
        <span
          key={i}
          className={styles.chip}
        >
          {set.bodyweight ? (
            <>
              <span className={styles.chipValue}>{set.bodyweight.base}</span>
              <span className={styles.chipSignedValue}>
                {set.bodyweight.added}
              </span>
              <span className={styles.chipX}>=</span>
              <span className={styles.chipValue}>{set.bodyweight.total}</span>
              <span className={styles.chipUnit}>{set.bodyweight.unit}</span>
            </>
          ) : (
            <span className={styles.chipValue}>{set.weight}</span>
          )}
          <span className={styles.chipX}>×</span>
          <span className={styles.chipValue}>{set.reps}</span>
          {set.toFailure && <IconFlame size={12} className={styles.chipFlame} />}
        </span>
      ))}
    </div>
  );
}
