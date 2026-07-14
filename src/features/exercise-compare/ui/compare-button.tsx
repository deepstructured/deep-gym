"use client";

import { useMemo, useState } from "react";
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
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";
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

/** Minimal shape of the sets being logged right now, in the display unit. */
export interface CompareCurrentSet {
  weight: string;
  reps: string;
  toFailure: boolean;
}

interface CompareButtonProps {
  exerciseId: string;
  exerciseName: string;
  unit: Unit;
  /** Sets entered in the current draft, for the side-by-side reference. */
  currentSets: CompareCurrentSet[];
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
        className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-muted"
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
  currentDate,
  onClose,
}: CompareButtonProps & { onClose: () => void }) {
  const { t } = useI18n();
  const { data: history, isLoading } = useExerciseHistory(exerciseId);

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
    (s) => s.weight.trim() || s.reps.trim(),
  );

  return (
    <Sheet open onClose={onClose} title={t("compare.title")}>
      <p className="mb-4 text-sm text-muted">{exerciseName}</p>

      {isLoading ? (
        <div className="flex justify-center py-10 text-muted">
          <Spinner size={24} />
        </div>
      ) : markedDates.size === 0 ? (
        <EmptyState
          title={t("compare.emptyTitle")}
          hint={t("compare.emptyHint")}
        />
      ) : (
        <div className="space-y-4">
          {/* This session, for reference — a past workout shows its date */}
          {filledCurrent.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium tracking-wide text-faint uppercase">
                {currentDate === todayISO()
                  ? t("compare.thisSession")
                  : formatDayFull(currentDate)}
              </p>
              <SetChips
                sets={filledCurrent.map((s) => ({
                  weight: s.weight.trim() || "—",
                  reps: s.reps.trim() || "—",
                  toFailure: s.toFailure,
                }))}
              />
            </div>
          )}

          {/* Day picker */}
          <button
            type="button"
            onClick={() => setShowCalendar((v) => !v)}
            className="flex w-full items-center gap-3 rounded-tile border border-line bg-raised px-4 py-3 text-left"
          >
            <IconCalendar size={18} className="text-lime" />
            <span className="flex-1 font-medium">
              {activeDate ? formatDayFull(activeDate) : t("compare.pickDay")}
            </span>
            <IconChevronDown
              size={18}
              className={cn(
                "text-faint transition-transform",
                showCalendar && "rotate-180",
              )}
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
              className="rounded-tile border border-line bg-surface p-3"
            />
          )}

          {/* Selected day's sets */}
          <div>
            <p className="mb-1.5 text-[11px] font-medium tracking-wide text-faint uppercase">
              {activeDate ? formatDayFull(activeDate) : t("compare.selectedDay")}
            </p>
            {selectedSets && selectedSets.length > 0 ? (
              <>
                <SetChips
                  sets={selectedSets.map((s) => ({
                    weight:
                      s.weight_kg != null
                        ? String(roundWeight(kgToUnit(s.weight_kg, unit)))
                        : "—",
                    reps: s.reps != null ? String(s.reps) : "—",
                    toFailure: s.to_failure,
                  }))}
                />
                {selectedNotes && (
                  <p className="mt-2 rounded-tile border border-line bg-raised px-3 py-2 text-sm text-muted">
                    {selectedNotes}
                  </p>
                )}
              </>
            ) : (
              <p className="rounded-tile border border-dashed border-line bg-surface/50 px-4 py-5 text-center text-sm text-muted">
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
  sets: { weight: string; reps: string; toFailure: boolean }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sets.map((set, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2.5 py-1 text-xs"
        >
          <span className="font-dot">{set.weight}</span>
          <span className="text-faint">×</span>
          <span className="font-dot">{set.reps}</span>
          {set.toFailure && <IconFlame size={12} className="text-flame" />}
        </span>
      ))}
    </div>
  );
}
