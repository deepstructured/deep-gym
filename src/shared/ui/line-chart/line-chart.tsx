"use client";

import { parseISO } from "date-fns";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { cn } from "@/shared/lib/cn";
import { formatAxisDate, toISODate } from "@/shared/lib/dates";
import { useElementWidth } from "@/shared/lib/use-element-width";
import styles from "./line-chart.module.scss";

export interface LineChartPoint {
  /** ISO date (yyyy-MM-dd) or full timestamp. */
  date: string;
  value: number;
}

interface LineChartProps {
  /** Chronological points; x is a true time scale, not the index. */
  points: LineChartPoint[];
  height?: number;
  formatValue: (value: number) => string;
  /** Date label for axis ticks and the scrub pill; `spanDays` is the whole
   *  visible range (0 for a single selected point). */
  formatDate?: (date: string, spanDays: number) => string;
  /** Controlled selection; omit to let the chart manage it. */
  activeIndex?: number | null;
  onActiveChange?: (index: number | null) => void;
  /** Indices drawn with a highlight ring (personal records). */
  markers?: ReadonlySet<number>;
  showTrend?: boolean;
  showAverage?: boolean;
  /** Secondary line, one value per point (e.g. a moving average). */
  overlay?: number[];
  /** Point dots; defaults to on while the series is readable (≤ 40). */
  showDots?: boolean;
  /** Value + date pill above the scrub line. */
  showTooltip?: boolean;
  /** Y labels and date ticks. */
  axes?: boolean;
  tone?: "white" | "lime";
  /** Dark dotted well behind the plot. */
  framed?: boolean;
  interactive?: boolean;
  /** Keep vertical page scrolling on touch (horizontal drags scrub). */
  allowScroll?: boolean;
  emptyLabel?: string;
  ariaLabel?: string;
  className?: string;
}

type Plotted = LineChartPoint & { x: number; y: number };

const DAY_MS = 86_400_000;

function timeOf(date: string): number {
  return parseISO(date).getTime() / DAY_MS;
}

function niceStep(range: number, count: number): number {
  const raw = range / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10;
  return step * magnitude;
}

/** Rounded axis domain and ticks around the data with a little headroom. */
function niceDomain(min: number, max: number, count = 3) {
  let range = max - min;
  if (range === 0) range = Math.max(Math.abs(max) * 0.1, 1);
  const padded = { lo: min - range * 0.08, hi: max + range * 0.08 };
  const step = niceStep(padded.hi - padded.lo, count);
  const lo = Math.floor(padded.lo / step) * step;
  const hi = Math.ceil(padded.hi / step) * step;
  const ticks: number[] = [];
  for (let value = lo; value <= hi + step / 2; value += step) {
    ticks.push(Math.round(value * 1000) / 1000);
  }
  return { lo, hi: hi === lo ? lo + step : hi, ticks };
}

/** Monotone cubic interpolation (same as d3.curveMonotoneX): smooth, never
 *  overshoots a data point, so a PR never looks higher than it was. */
function monotonePath(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${points[0].x},${points[0].y}`;

  const sign = (value: number) => (value < 0 ? -1 : value > 0 ? 1 : 0);
  const tangents = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const h0 = points[i].x - points[i - 1].x;
    const h1 = points[i + 1].x - points[i].x;
    const s0 = (points[i].y - points[i - 1].y) / (h0 || 1e-9);
    const s1 = (points[i + 1].y - points[i].y) / (h1 || 1e-9);
    const p = (s0 * h1 + s1 * h0) / (h0 + h1 || 1e-9);
    tangents[i] =
      (sign(s0) + sign(s1)) *
        Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }
  const endSlope = (a: number, b: number, t: number) => {
    const h = points[b].x - points[a].x;
    return h ? (3 * (points[b].y - points[a].y) / h - t) / 2 : t;
  };
  if (n === 2) {
    const slope =
      (points[1].y - points[0].y) / (points[1].x - points[0].x || 1e-9);
    tangents[0] = slope;
    tangents[1] = slope;
  } else {
    tangents[0] = endSlope(0, 1, tangents[1]);
    tangents[n - 1] = endSlope(n - 2, n - 1, tangents[n - 2]);
  }

  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const h = (b.x - a.x) / 3;
    d += ` C${(a.x + h).toFixed(1)},${(a.y + tangents[i] * h).toFixed(1)} ${(b.x - h).toFixed(1)},${(b.y - tangents[i + 1] * h).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }
  return d;
}

/** Least-squares line over (time, value). */
function regression(points: { t: number; value: number }[]) {
  const n = points.length;
  if (n < 2) return null;
  const meanT = points.reduce((s, p) => s + p.t, 0) / n;
  const meanV = points.reduce((s, p) => s + p.value, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - meanT) * (p.value - meanV);
    den += (p.t - meanT) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: meanV - slope * meanT };
}

/**
 * Interactive time-series chart. Press (or hover) and slide to scrub through
 * the points; the selection stays after lifting the finger until a tap
 * elsewhere. Touch keeps vertical page scrolling unless `allowScroll` is off.
 */
export function LineChart({
  points,
  height = 168,
  formatValue,
  formatDate = formatAxisDate,
  activeIndex,
  onActiveChange,
  markers,
  showTrend = false,
  showAverage = false,
  overlay,
  showDots,
  showTooltip = true,
  axes = true,
  tone = "white",
  framed = true,
  interactive = true,
  allowScroll = true,
  emptyLabel,
  ariaLabel,
  className,
}: LineChartProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [measureRef, width] = useElementWidth<HTMLDivElement>();
  const attachRef = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperRef.current = node;
      measureRef(node);
    },
    [measureRef],
  );
  const gradientId = `line-${useId().replace(/:/g, "")}`;

  const [internalActive, setInternalActive] = useState<number | null>(null);
  const active = activeIndex !== undefined ? activeIndex : internalActive;
  const pressed = useRef(false);
  const lastPointerType = useRef<string>("mouse");

  const setActive = useCallback(
    (index: number | null) => {
      if (activeIndex === undefined) setInternalActive(index);
      onActiveChange?.(index);
    },
    [activeIndex, onActiveChange],
  );

  // A new series (period/metric switch) drops a stale selection.
  const seriesKey = `${points.length}:${points[0]?.date}:${points.at(-1)?.date}`;
  useEffect(() => {
    setInternalActive(null);
  }, [seriesKey]);

  const layout = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map((p) => p.value);
    const domain = niceDomain(Math.min(...values), Math.max(...values));
    const labels = domain.ticks.map((tick) => formatValue(tick));
    const longest = Math.max(...labels.map((label) => label.length));
    const gutter = axes ? Math.max(24, longest * 6.2 + 10) : 6;
    const top = showTooltip ? 30 : 10;
    const bottom = axes ? 22 : 8;
    const left = 8;
    const right = width - gutter;
    const plotBottom = height - bottom;

    const times = points.map((p) => timeOf(p.date));
    const t0 = times[0];
    const t1 = times[times.length - 1];
    const span = t1 - t0;
    const x = (t: number) =>
      span === 0 ? (left + right) / 2 : left + ((t - t0) / span) * (right - left);
    const y = (value: number) =>
      plotBottom -
      ((value - domain.lo) / (domain.hi - domain.lo)) * (plotBottom - top);

    const plotted: Plotted[] = points.map((p, i) => ({
      ...p,
      x: x(times[i]),
      y: y(p.value),
    }));

    const trend = showTrend
      ? regression(points.map((p, i) => ({ t: times[i], value: p.value })))
      : null;
    const average = values.reduce((s, v) => s + v, 0) / values.length;

    // Date ticks: start, middle and end of the time domain.
    const dateTicks =
      span === 0
        ? [{ x: (left + right) / 2, t: t0, anchor: "middle" as const }]
        : [
            { x: left, t: t0, anchor: "start" as const },
            ...(right - left > 220
              ? [{ x: (left + right) / 2, t: t0 + span / 2, anchor: "middle" as const }]
              : []),
            { x: right, t: t1, anchor: "end" as const },
          ];

    const overlayPath =
      overlay && overlay.length === points.length
        ? monotonePath(
            overlay.map((value, i) => ({ x: plotted[i].x, y: y(value) })),
          )
        : null;

    return {
      domain,
      labels,
      overlayPath,
      top,
      left,
      right,
      plotBottom,
      plotted,
      path: monotonePath(plotted),
      trendLine: trend
        ? {
            x1: plotted[0].x,
            y1: y(trend.intercept + trend.slope * t0),
            x2: plotted[plotted.length - 1].x,
            y2: y(trend.intercept + trend.slope * t1),
          }
        : null,
      averageY: y(average),
      dateTicks: dateTicks.map((tick) => ({
        ...tick,
        label: formatDate(toISODate(new Date(tick.t * DAY_MS)), span),
      })),
      y,
    };
  }, [
    points,
    width,
    height,
    axes,
    showTooltip,
    showTrend,
    overlay,
    formatValue,
    formatDate,
  ]);

  // Tap outside clears a touch selection (mouse clears on leave instead).
  useEffect(() => {
    if (active == null || lastPointerType.current === "mouse") return;
    function onDocumentPointerDown(event: globalThis.PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setActive(null);
    }
    document.addEventListener("pointerdown", onDocumentPointerDown);
    return () =>
      document.removeEventListener("pointerdown", onDocumentPointerDown);
  }, [active, setActive]);

  if (!layout) {
    return (
      <div
        ref={attachRef}
        className={cn(styles.chart, framed && styles.framed, className)}
        style={{ height }}
      >
        {emptyLabel && <p className={styles.empty}>{emptyLabel}</p>}
      </div>
    );
  }

  const { plotted } = layout;
  const dots = showDots ?? plotted.length <= 40;
  const baseline = layout.plotBottom;
  const area =
    plotted.length > 1
      ? `${layout.path} L${plotted.at(-1)!.x.toFixed(1)},${baseline} L${plotted[0].x.toFixed(1)},${baseline} Z`
      : "";
  const activePoint = active != null ? plotted[active] : null;
  const lineColor = tone === "lime" ? "var(--color-lime)" : "#fff";

  function indexAt(clientX: number): number {
    const rect = wrapperRef.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < plotted.length; i++) {
      const distance = Math.abs(plotted[i].x - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }

  function select(index: number) {
    if (index === active) return;
    if (pressed.current && lastPointerType.current !== "mouse") {
      navigator.vibrate?.(4);
    }
    setActive(index);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    lastPointerType.current = event.pointerType;
    pressed.current = true;
    if (event.pointerType === "mouse") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    select(indexAt(event.clientX));
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    if (!pressed.current && event.pointerType !== "mouse") return;
    lastPointerType.current = event.pointerType;
    select(indexAt(event.clientX));
  }

  function onPointerEnd() {
    pressed.current = false;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!interactive) return;
    lastPointerType.current = "keyboard";
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      const start = active ?? (step > 0 ? -1 : plotted.length);
      setActive(Math.max(0, Math.min(plotted.length - 1, start + step)));
    } else if (event.key === "Escape") {
      setActive(null);
    }
  }

  return (
    <div
      ref={attachRef}
      role="img"
      aria-label={ariaLabel}
      tabIndex={interactive ? 0 : undefined}
      data-gesture={interactive ? "scrub" : undefined}
      className={cn(
        styles.chart,
        framed && styles.framed,
        interactive && styles.interactive,
        className,
      )}
      style={{
        height,
        touchAction: interactive && !allowScroll ? "none" : "pan-y",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={() => {
        // The browser took the gesture over for scrolling.
        pressed.current = false;
        if (lastPointerType.current !== "mouse") setActive(null);
      }}
      onPointerLeave={(event) => {
        pressed.current = false;
        if (event.pointerType === "mouse") setActive(null);
      }}
      onKeyDown={onKeyDown}
    >
      <svg width={width} height={height} className={styles.svg}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            {tone === "lime" ? (
              <>
                <stop offset="0" stopColor="var(--color-lime)" stopOpacity="0.22" />
                <stop offset="1" stopColor="var(--color-lime)" stopOpacity="0" />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="#4054d6" stopOpacity="0.34" />
                <stop offset="1" stopColor="#182788" stopOpacity="0" />
              </>
            )}
          </linearGradient>
        </defs>

        {axes &&
          layout.domain.ticks.map((tick, index) => {
            const tickY = layout.y(tick);
            if (tickY < layout.top - 4 || tickY > baseline + 1) return null;
            return (
              <g key={tick}>
                <line
                  x1={layout.left}
                  x2={layout.right}
                  y1={tickY}
                  y2={tickY}
                  className={styles.grid}
                />
                <text
                  x={width - 4}
                  y={tickY + 3.5}
                  textAnchor="end"
                  className={styles.axisValue}
                >
                  {layout.labels[index]}
                </text>
              </g>
            );
          })}

        {area && <path d={area} fill={`url(#${gradientId})`} />}

        {showAverage && plotted.length > 1 && (
          <line
            x1={layout.left}
            x2={layout.right}
            y1={layout.averageY}
            y2={layout.averageY}
            className={styles.average}
          />
        )}

        {layout.trendLine && (
          <line {...layout.trendLine} className={styles.trend} />
        )}

        {layout.overlayPath && (
          <path d={layout.overlayPath} className={styles.overlay} />
        )}

        <path
          d={layout.path}
          fill="none"
          stroke={lineColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.08"
        />
        <path
          d={layout.path}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={activePoint ? 0.75 : 0.95}
        />

        {plotted.map((point, index) => {
          const isLast = index === plotted.length - 1;
          const isMarker = markers?.has(index) ?? false;
          if (!dots && !isMarker && !isLast) return null;
          return (
            <g key={`${point.date}-${index}`}>
              {isMarker && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="5.2"
                  className={styles.marker}
                />
              )}
              {isLast && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="7"
                  fill="var(--color-lime)"
                  opacity="0.16"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={isLast ? 3.6 : 2.5}
                fill={isLast ? "var(--color-lime)" : lineColor}
                opacity={isLast ? 1 : 0.72}
              />
            </g>
          );
        })}

        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={layout.top - 6}
              y2={baseline}
              className={styles.cursor}
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="9"
              fill="var(--color-lime)"
              opacity="0.18"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="4.6"
              fill="var(--color-lime)"
              stroke="#0a0a0c"
              strokeWidth="2"
            />
          </g>
        )}

        {axes &&
          layout.dateTicks.map((tick) => (
            <text
              key={`${tick.anchor}-${tick.t}`}
              x={tick.x}
              y={height - 6}
              textAnchor={tick.anchor}
              className={styles.axisDate}
            >
              {tick.label}
            </text>
          ))}
      </svg>

      {activePoint && showTooltip && (
        <div
          className={styles.pill}
          style={{
            left: activePoint.x,
            transform: `translateX(-${Math.min(100, Math.max(0, (activePoint.x / width) * 100))}%)`,
          }}
        >
          <span className={styles.pillValue}>
            {formatValue(activePoint.value)}
          </span>
          <span className={styles.pillDate}>
            {formatDate(activePoint.date, 0)}
          </span>
        </div>
      )}
    </div>
  );
}
