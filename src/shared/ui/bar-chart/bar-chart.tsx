"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/shared/lib/cn";
import styles from "./bar-chart.module.scss";

export interface BarChartBar {
  key: string;
  /** Axis label under the bar (may be empty to skip). */
  label: string;
  /** Label used in the scrub pill; defaults to `label`. */
  title?: string;
  value: number;
}

interface BarChartProps {
  bars: BarChartBar[];
  height?: number;
  formatValue: (value: number) => string;
  /** Emphasized bar, e.g. the current week. */
  highlightIndex?: number;
  /** Show every nth axis label (the last one is always shown). */
  labelEvery?: number;
  onActiveChange?: (index: number | null) => void;
  interactive?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** Compact column chart; press and slide across it to read single bars. */
export function BarChart({
  bars,
  height = 132,
  formatValue,
  highlightIndex,
  labelEvery = 1,
  onActiveChange,
  interactive = true,
  className,
  ariaLabel,
}: BarChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const pressed = useRef(false);
  const pointerType = useRef("mouse");
  const max = Math.max(...bars.map((bar) => bar.value), 0);

  function update(index: number | null) {
    setActive(index);
    onActiveChange?.(index);
  }

  function indexAt(clientX: number) {
    const rect = ref.current!.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(bars.length - 1, Math.floor(ratio * bars.length)));
  }

  useEffect(() => {
    if (active == null || pointerType.current === "mouse") return;
    function onDown(event: globalThis.PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setActive(null);
        onActiveChange?.(null);
      }
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active, onActiveChange]);

  const handlers = interactive
    ? {
        onPointerDown(event: PointerEvent<HTMLDivElement>) {
          pointerType.current = event.pointerType;
          pressed.current = true;
          update(indexAt(event.clientX));
        },
        onPointerMove(event: PointerEvent<HTMLDivElement>) {
          if (!pressed.current && event.pointerType !== "mouse") return;
          pointerType.current = event.pointerType;
          const next = indexAt(event.clientX);
          if (next !== active) update(next);
        },
        onPointerUp() {
          pressed.current = false;
        },
        onPointerCancel() {
          pressed.current = false;
          update(null);
        },
        onPointerLeave(event: PointerEvent<HTMLDivElement>) {
          pressed.current = false;
          if (event.pointerType === "mouse") update(null);
        },
      }
    : {};

  return (
    <div
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      data-gesture={interactive ? "scrub" : undefined}
      className={cn(styles.chart, interactive && styles.interactive, className)}
      style={{ height }}
      {...handlers}
    >
      {active != null && bars[active] && (
        <div
          className={styles.pill}
          style={{
            left: `${((active + 0.5) / bars.length) * 100}%`,
            transform: `translateX(-${((active + 0.5) / bars.length) * 100}%)`,
          }}
        >
          <span className={styles.pillValue}>
            {formatValue(bars[active].value)}
          </span>
          <span className={styles.pillLabel}>
            {bars[active].title ?? bars[active].label}
          </span>
        </div>
      )}
      <div
        className={styles.columns}
        style={{
          gap:
            bars.length > 30 ? "2px" : bars.length > 16 ? "3px" : undefined,
        }}
      >
        {bars.map((bar, index) => {
          const ratio = max > 0 ? bar.value / max : 0;
          const showLabel =
            index === bars.length - 1 ||
            (bars.length - 1 - index) % labelEvery === 0;
          return (
            <div key={bar.key} className={styles.column}>
              <div className={styles.track}>
                <span
                  className={cn(
                    styles.bar,
                    bar.value === 0 && styles.barEmpty,
                    index === highlightIndex && styles.barHighlight,
                    index === active && styles.barActive,
                    active != null && index !== active && styles.barDim,
                  )}
                  style={{ height: `${Math.max(ratio * 100, bar.value > 0 ? 6 : 3)}%` }}
                />
              </div>
              <span className={styles.label}>{showLabel ? bar.label : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
