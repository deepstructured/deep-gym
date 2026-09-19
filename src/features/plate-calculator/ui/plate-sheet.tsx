"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useProfile } from "@/entities/user";
import type { Equipment } from "@/shared/config/workout";
import { useI18n } from "@/shared/i18n";
import {
  buildPlateSpecs,
  calcPlateVariants,
  calcPlatesGreedy,
  formatWeight,
  kgToUnit,
  nextDumbbellSteps,
  nextPlateSteps,
  roundWeight,
  type PlateCount,
  type Unit,
} from "@/shared/lib/weight";
import { cn } from "@/shared/lib/cn";
import { DotValue, IconArrowUp, Sheet, Tag } from "@/shared/ui";
import styles from "./plate-sheet.module.scss";

export interface PlateContext {
  weightKg: number;
  /** Changes how the weight is interpreted:
   *  dumbbell — weight of ONE dumbbell, no plate breakdown;
   *  free_weight (barbell) — the bar is subtracted, plates per side;
   *  machine — the total split into plate pairs (60 → 2×20 + 2×10).
   *  crossover has no plates — the button isn't shown for it. */
  equipment?: Equipment;
  /** Per-exercise unit override; defaults to the profile unit. */
  displayUnit?: Unit;
}

interface PlateSheetProps {
  context: PlateContext | null;
  onClose: () => void;
}

export function PlateSheet({ context, onClose }: PlateSheetProps) {
  const { t } = useI18n();
  const { data: profile } = useProfile();

  const equipment = context?.equipment ?? "machine";
  const isDumbbell = equipment === "dumbbell";
  const isBarbell = equipment === "free_weight";

  const unit: Unit = context?.displayUnit ?? profile?.unit ?? "kg";
  const barKg = profile?.bar_weight_kg ?? 20;

  const open = context != null;
  const weightKg = context?.weightKg ?? 0;

  const specs = useMemo(
    () => buildPlateSpecs(profile?.plates_kg ?? [], profile?.plates_lb ?? []),
    [profile?.plates_kg, profile?.plates_lb],
  );

  const variants = useMemo(
    () =>
      open && !isDumbbell && weightKg > 0
        ? calcPlateVariants(weightKg, specs, isBarbell ? barKg : undefined)
        : [],
    [open, isDumbbell, isBarbell, weightKg, specs, barKg],
  );

  const greedy = useMemo(
    () =>
      open && !isDumbbell && weightKg > 0 && variants.length === 0
        ? calcPlatesGreedy(weightKg, specs, isBarbell ? barKg : undefined)
        : null,
    [open, isDumbbell, isBarbell, weightKg, specs, barKg, variants.length],
  );

  const barCoversAll = isBarbell && open && weightKg <= barKg;

  // Next progression step: the lightest plates to add on top of the current
  // load (or the next dumbbells in the rack) and how big the jump is.
  const plateSteps = useMemo(
    () =>
      open && !isDumbbell && weightKg > 0
        ? nextPlateSteps(Math.max(weightKg, isBarbell ? barKg : 0), specs)
        : [],
    [open, isDumbbell, isBarbell, weightKg, barKg, specs],
  );
  const dumbbellSteps = useMemo(
    () =>
      open && isDumbbell && weightKg > 0
        ? nextDumbbellSteps(weightKg, unit)
        : [],
    [open, isDumbbell, weightKg, unit],
  );
  const percentOver = (targetKg: number) => {
    const base = weightKg > 0 ? weightKg : targetKg;
    const pct = Math.round(((targetKg - base) / base) * 1000) / 10;
    return `+${pct}%`;
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        isDumbbell
          ? t("plates.dumbbells")
          : isBarbell
            ? t("plates.loadBar")
            : t("plates.loadPlates")
      }
    >
      {open && (
        <div className={styles.body}>
          <div className={cn(styles.hero, "grad-indigo glow-indigo")}>
            <div className={cn(styles.heroDots, "dots-bg")} />
            <DotValue
              value={roundWeight(kgToUnit(weightKg, unit))}
              suffix={isDumbbell ? t("plates.each", { unit }) : unit}
              className={styles.heroValue}
              suffixClassName={styles.heroSuffix}
            />
            {isBarbell && !barCoversAll && (
              <p className={styles.heroBarNote}>
                {t("plates.includesBar", { bar: formatWeight(barKg, unit) })}
              </p>
            )}
          </div>

          {(plateSteps.length > 0 || dumbbellSteps.length > 0) && (
            <div className={styles.next}>
              <div className={styles.nextHead}>
                <span className={styles.nextIcon}>
                  <IconArrowUp size={13} />
                </span>
                <p className={styles.nextTitle}>{t("plates.nextStep")}</p>
                <p className={styles.nextHint}>
                  {isDumbbell
                    ? t("plates.nextDumbbellHint")
                    : t("plates.nextHint")}
                </p>
              </div>

              {isDumbbell ? (
                <div className={styles.nextChips}>
                  {dumbbellSteps.map((targetKg, index) => (
                    <span
                      key={targetKg}
                      className={cn(
                        styles.nextChip,
                        index === 0 && styles.nextChipBest,
                      )}
                    >
                      <span className={styles.nextChipValue}>
                        {roundWeight(kgToUnit(targetKg, unit))} {unit}
                      </span>
                      <span className={styles.nextPct}>
                        {percentOver(targetKg)}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <>
                  {/* The lightest jump, spelled out. */}
                  <div className={styles.nextRow}>
                    <div className={styles.nextAdd}>
                      <span className={styles.nextPlus}>+</span>
                      {plateSteps[0].add.map((count) => (
                        <PlateChip
                          key={`${count.plate.unit}-${count.plate.value}`}
                          item={count}
                        />
                      ))}
                    </div>
                    <div className={styles.nextTarget}>
                      <DotValue
                        value={roundWeight(
                          kgToUnit(plateSteps[0].targetKg, unit),
                        )}
                        suffix={unit}
                        className={styles.nextValue}
                      />
                      <span className={styles.nextPct}>
                        {percentOver(plateSteps[0].targetKg)}
                      </span>
                    </div>
                  </div>
                  {plateSteps.length > 1 && (
                    <div className={styles.nextChips}>
                      {plateSteps.slice(1).map((step) => (
                        <span key={step.deltaKg} className={styles.nextChip}>
                          <span className={styles.nextChipAdd}>
                            +
                            {step.add
                              .map((c) => `${c.count * 2}×${c.plate.value}`)
                              .join(" ")}
                          </span>
                          <span className={styles.nextChipValue}>
                            {roundWeight(kgToUnit(step.targetKg, unit))} {unit}
                          </span>
                          <span className={styles.nextPct}>
                            {percentOver(step.targetKg)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {isDumbbell ? (
            <div className={styles.stack}>
              <div className={styles.dumbbellRow}>
                <span className={styles.dumbbellLabel}>
                  <DumbbellGlyph />
                  <span className={styles.dumbbellName}>
                    {t("plates.dumbbell", {
                      weight: formatWeight(weightKg, unit),
                    })}
                  </span>
                </span>
                <DotValue value="x2" className={styles.dumbbellCount} />
              </div>
              <p className={styles.centerNote}>
                {t("plates.oneEachHand")} ·{" "}
                <span className={styles.dotFont}>
                  {roundWeight(kgToUnit(weightKg * 2, unit))}
                </span>{" "}
                {t("plates.totalLoad", { unit })}
              </p>
            </div>
          ) : barCoversAll ? (
            <p className={styles.centerNoteBare}>
              {t("plates.barCovers")}
            </p>
          ) : variants.length > 0 ? (
            <div className={styles.stack}>
              <p className={styles.sectionLabel}>
                {t("plates.ways")}
              </p>
              {variants.map((variant, index) => (
                <div
                  key={index}
                  className={cn(
                    styles.variant,
                    index === 0 && styles.variantBest,
                  )}
                >
                  <div className={styles.variantChips}>
                    {variant.counts.map((count) => (
                      <PlateChip key={`${count.plate.unit}-${count.plate.value}`} item={count} />
                    ))}
                    {index === 0 && (
                      <Tag tone="lime" className={styles.bestTag}>
                        {t("plates.fewest")}
                      </Tag>
                    )}
                  </div>
                  {(isBarbell ||
                    Math.abs(variant.assembledKg - weightKg) > 0.05) && (
                    <p className={styles.variantNote}>
                      {isBarbell && (
                        <>
                          {t("plates.perSide")}{" "}
                          {variant.counts
                            .map(
                              (c) =>
                                `${c.count} × ${c.plate.value} ${c.plate.unit}`,
                            )
                            .join(" + ")}
                        </>
                      )}
                      {Math.abs(variant.assembledKg - weightKg) > 0.05 && (
                        <>
                          {isBarbell && " · "}≈{" "}
                          {formatWeight(variant.assembledKg, unit)}{" "}
                          {t("plates.total")}
                        </>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : greedy && greedy.counts.length > 0 ? (
            <div className={styles.stack}>
              <p className={styles.sectionLabel}>
                {t("plates.closest")}
              </p>
              <div className={styles.variant}>
                <div className={styles.variantChips}>
                  {greedy.counts.map((count) => (
                    <PlateChip key={`${count.plate.unit}-${count.plate.value}`} item={count} />
                  ))}
                </div>
              </div>
              <p className={styles.centerNote}>
                {t("plates.missing", {
                  weight: formatWeight(greedy.remainderKg, unit),
                })}{" "}
                <Link href="/settings" className={styles.settingsLink} onClick={onClose}>
                  {t("plates.editPlates")}
                </Link>
              </p>
            </div>
          ) : (
            <p className={styles.centerNoteBare}>
              {t("plates.none")}{" "}
              <Link href="/settings" className={styles.settingsLink} onClick={onClose}>
                {t("plates.addInSettings")}
              </Link>
              .
            </p>
          )}

        </div>
      )}
    </Sheet>
  );
}

/** "2 × 20 kg" chip; count shown as the TOTAL number of plates (both sides). */
function PlateChip({ item }: { item: PlateCount }) {
  return (
    <span className={styles.plateChip}>
      <span
        className={styles.plateRing}
        style={{
          width: 16,
          height: 16,
          borderWidth: Math.min(6, 2.5 + item.plate.kg / 9),
        }}
      />
      <span className={styles.plateCount}>{item.count * 2}</span>
      <span className={styles.plateX}>×</span>
      <span>
        {item.plate.value} {item.plate.unit}
      </span>
    </span>
  );
}

function DumbbellGlyph() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-lime)"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M6.5 6.5v11M17.5 6.5v11" />
      <path d="M3 9v6M21 9v6" />
      <path d="M6.5 12h11" />
    </svg>
  );
}
