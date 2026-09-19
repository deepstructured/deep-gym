"use client";

import { useMemo, useState } from "react";
import type { ExerciseSetRecord } from "@/entities/workout";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatDay } from "@/shared/lib/dates";
import {
  periodStart,
  usePreferredPeriod,
  type PeriodKey,
} from "@/shared/lib/period";
import { kgToUnit, roundWeight, type Unit } from "@/shared/lib/weight";
import {
  DotValue,
  Fullscreen,
  IconExpand,
  IconInfo,
  IconTrophy,
  LineChart,
  PeriodSwitch,
} from "@/shared/ui";
import {
  formatMetricDelta,
  formatMetricValue,
  formatPercent,
} from "../model/format";
import {
  filterByLoad,
  metricSeries,
  movingAverage,
  recordIndices,
  summarizeSeries,
  type LoadFilter,
  type ProgressMetric,
  type ProgressPoint,
  type SeriesSummary,
} from "../model/stats";
import {
  LoadFilterChips,
  useFilterCaption,
  useLoadFilterState,
} from "./load-filter";
import { MetricInfoSheet } from "./metric-info-sheet";
import styles from "./exercise-progress.module.scss";

export const EXTERNAL_METRICS: ProgressMetric[] = [
  "topSet",
  "oneRm",
  "volume",
  "reps",
];
export const BODYWEIGHT_METRICS: ProgressMetric[] = ["reps", "addedLoad"];

type ViewPoint = ProgressPoint & { value: number };

interface ProgressView {
  all: ViewPoint[];
  visible: ViewPoint[];
  /** Record sessions inside `visible` (indices into it). */
  markers: Set<number>;
  summary: SeriesSummary | null;
}

function buildView(
  records: ExerciseSetRecord[],
  metric: ProgressMetric,
  unit: Unit,
  period: PeriodKey,
  filter: LoadFilter,
): ProgressView {
  const series = metricSeries(filterByLoad(records, filter), metric);
  const all = series.map((point) => ({
    ...point,
    value: metric === "reps" ? point.valueKg : kgToUnit(point.valueKg, unit),
  }));
  // Records are all-time: a period view only shows which of its sessions
  // beat everything before them.
  const prs = recordIndices(all.map((point) => point.value));
  const from = periodStart(period);
  const startIndex = from ? all.findIndex((point) => point.date >= from) : 0;
  const visible = startIndex < 0 ? [] : all.slice(startIndex);
  const markers = new Set(
    [...prs]
      .filter((index) => startIndex >= 0 && index >= startIndex)
      .map((index) => index - startIndex),
  );
  return { all, visible, markers, summary: summarizeSeries(visible) };
}

function metricUnit(metric: ProgressMetric, unit: Unit): string {
  return metric === "reps" ? "" : unit;
}

interface ExerciseProgressPanelProps {
  records: ExerciseSetRecord[] | undefined;
  unit: Unit;
  bodyweight: boolean;
  exerciseName: string;
  /** Shown under the title in full screen (e.g. the muscle group). */
  subtitle?: string;
  /** Controlled metric, e.g. persisted by a home widget. */
  metric?: ProgressMetric;
  onMetricChange?: (metric: ProgressMetric) => void;
  /** Controlled period; defaults to the remembered viewer-wide period. */
  period?: PeriodKey;
  onPeriodChange?: (period: PeriodKey) => void;
  showPeriodSwitch?: boolean;
  /** Controlled load filter (e.g. shared with the explorer's tiles). */
  loadFilter?: LoadFilter;
  onLoadFilterChange?: (filter: LoadFilter) => void;
  /** Compact: smaller chart, no summary row (home widget). */
  compact?: boolean;
  chartHeight?: number;
  className?: string;
}

/**
 * Metric switcher + interactive chart + period summary for one exercise.
 * Hold and slide on the chart to inspect sessions; the expand button opens
 * the same data in a focused full-screen view with extra tools.
 */
export function ExerciseProgressPanel({
  records,
  unit,
  bodyweight,
  exerciseName,
  subtitle,
  metric: controlledMetric,
  onMetricChange,
  period: controlledPeriod,
  onPeriodChange,
  showPeriodSwitch = true,
  loadFilter: controlledFilter,
  onLoadFilterChange,
  compact = false,
  chartHeight,
  className,
}: ExerciseProgressPanelProps) {
  const { t } = useI18n();
  const metrics = bodyweight ? BODYWEIGHT_METRICS : EXTERNAL_METRICS;
  const [ownMetric, setOwnMetric] = useState<ProgressMetric>(metrics[0]);
  const requested = controlledMetric ?? ownMetric;
  const metric = metrics.includes(requested) ? requested : metrics[0];
  const [preferredPeriod, setPreferredPeriod] = usePreferredPeriod();
  const period = controlledPeriod ?? preferredPeriod;
  const setPeriod = onPeriodChange ?? setPreferredPeriod;
  const [ownFilter, setOwnFilter] = useLoadFilterState(bodyweight);
  const filter = controlledFilter ?? ownFilter;
  const filterCaption = useFilterCaption(filter, unit);

  const [active, setActive] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const view = useMemo(
    () => buildView(records ?? [], metric, unit, period, filter),
    [records, metric, unit, period, filter],
  );

  function changeMetric(next: ProgressMetric) {
    setOwnMetric(next);
    setActive(null);
    onMetricChange?.(next);
  }

  function changePeriod(next: PeriodKey) {
    setActive(null);
    setPeriod(next);
  }

  function changeFilter(next: LoadFilter) {
    setActive(null);
    // At one fixed load the top weight is a flat line — reps tell the story.
    if (next.mode === "weight" && metric === "topSet") changeMetric("reps");
    (onLoadFilterChange ?? setOwnFilter)(next);
  }

  return (
    <div className={cn(styles.panel, className)}>
      <div className={styles.toolbar}>
        <MetricChips metrics={metrics} value={metric} onChange={changeMetric} />
        <button
          type="button"
          aria-label={t("stats.info.title")}
          onClick={() => setInfoOpen(true)}
          className={styles.iconButton}
        >
          <IconInfo size={16} />
        </button>
        <button
          type="button"
          aria-label={t("stats.fullscreen")}
          onClick={() => setExpanded(true)}
          className={styles.iconButton}
        >
          <IconExpand size={15} />
        </button>
      </div>
      {!bodyweight && (
        <LoadFilterChips
          records={records ?? []}
          unit={unit}
          value={filter}
          onChange={changeFilter}
        />
      )}
      {!compact && (
        <p className={styles.caption}>
          {t(`stats.caption.${metric}`)}
          {!bodyweight && <> · {filterCaption}</>}
        </p>
      )}

      <Readout
        view={view}
        metric={metric}
        unit={unit}
        period={period}
        active={active}
        compact={compact}
      />

      <ProgressChart
        view={view}
        metric={metric}
        unit={unit}
        height={chartHeight ?? (compact ? 132 : 176)}
        active={active}
        onActiveChange={setActive}
        onShowAll={() => changePeriod("all")}
      />

      {showPeriodSwitch && (
        <PeriodSwitch value={period} onChange={changePeriod} />
      )}

      {!compact && view.summary && (
        <SummaryRow summary={view.summary} metric={metric} unit={unit} />
      )}

      <MetricInfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        active={metric}
        metrics={metrics}
      />

      <ProgressFullscreen
        open={expanded}
        onClose={() => setExpanded(false)}
        records={records ?? []}
        exerciseName={exerciseName}
        subtitle={subtitle}
        unit={unit}
        metrics={metrics}
        metric={metric}
        onMetricChange={changeMetric}
        period={period}
        onPeriodChange={changePeriod}
        filter={filter}
        onFilterChange={bodyweight ? undefined : changeFilter}
      />
    </div>
  );
}

function MetricChips({
  metrics,
  value,
  onChange,
}: {
  metrics: ProgressMetric[];
  value: ProgressMetric;
  onChange: (metric: ProgressMetric) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={cn(styles.metrics, "no-scrollbar")}>
      {metrics.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className={cn(
            styles.metricButton,
            option === value && styles.metricButtonActive,
          )}
        >
          {t(`stats.metric.${option}`)}
        </button>
      ))}
    </div>
  );
}

function Readout({
  view,
  metric,
  unit,
  period,
  active,
  compact,
}: {
  view: ProgressView;
  metric: ProgressMetric;
  unit: Unit;
  period: PeriodKey;
  active: number | null;
  compact?: boolean;
}) {
  const { t, tn } = useI18n();
  const point =
    active != null ? view.visible[active] : view.visible.at(-1) ?? null;
  const suffix = metricUnit(metric, unit);

  if (!point) {
    return (
      <div className={styles.readout}>
        <DotValue value="—" className={styles.value} />
      </div>
    );
  }

  const base = view.visible[0];
  const change = point.value - base.value;
  const pct = base.value !== 0 ? (change / Math.abs(base.value)) * 100 : null;
  const bestSet =
    point.best?.weightKg != null && point.best.reps != null
      ? `${roundWeight(kgToUnit(point.best.weightKg, unit))} × ${point.best.reps}`
      : null;
  const showDelta = view.visible.length > 1 && (active == null || active > 0);

  return (
    <div className={cn(styles.readout, compact && styles.readoutCompact)}>
      <div className={styles.readoutMain}>
        <DotValue
          value={formatMetricValue(point.value, metric)}
          suffix={suffix || undefined}
          className={cn(styles.value, compact && styles.valueCompact)}
          suffixClassName={styles.valueSuffix}
        />
        <p className={styles.readoutMeta}>
          {active == null && <>{t("stats.latest")} · </>}
          {formatDay(point.date)}
          {active != null && bestSet && metric !== "reps" && (
            <> · {bestSet}</>
          )}
          {active != null && <> · {tn("count.sets", point.sets)}</>}
          {active != null && view.markers.has(active) && (
            <span className={styles.prBadge}>
              <IconTrophy size={11} />
              {t("stats.pr")}
            </span>
          )}
        </p>
      </div>
      {showDelta && (
        <div
          className={cn(
            styles.delta,
            change > 0 && styles.deltaUp,
            change < 0 && styles.deltaDown,
          )}
        >
          <span className={styles.deltaValue}>
            {formatMetricDelta(change, metric)}
            {suffix && <small> {suffix}</small>}
          </span>
          <span className={styles.deltaMeta}>
            {pct != null && <>{formatPercent(pct)} · </>}
            {active != null ? t("stats.vsStart") : t(`period.over.${period}`)}
          </span>
        </div>
      )}
    </div>
  );
}

function ProgressChart({
  view,
  metric,
  unit,
  height,
  active,
  onActiveChange,
  onShowAll,
  showTrend = false,
  showAverage = false,
  showRecords = true,
  showSmoothing = false,
  allowScroll = true,
}: {
  view: ProgressView;
  metric: ProgressMetric;
  unit: Unit;
  height: number;
  active: number | null;
  onActiveChange: (index: number | null) => void;
  onShowAll: () => void;
  showTrend?: boolean;
  showAverage?: boolean;
  showRecords?: boolean;
  showSmoothing?: boolean;
  allowScroll?: boolean;
}) {
  const { t } = useI18n();
  const suffix = metricUnit(metric, unit);

  if (view.all.length > 0 && view.visible.length === 0) {
    return (
      <div className={styles.emptyPeriod} style={{ height }}>
        <p>{t("stats.emptyPeriod")}</p>
        <button type="button" onClick={onShowAll} className={styles.showAll}>
          {t("stats.showAllTime")}
        </button>
      </div>
    );
  }

  return (
    <LineChart
      points={view.visible}
      height={height}
      formatValue={(value) => formatMetricValue(value, metric)}
      activeIndex={active}
      onActiveChange={onActiveChange}
      markers={showRecords ? view.markers : undefined}
      showTrend={showTrend}
      showAverage={showAverage}
      overlay={
        showSmoothing && view.visible.length > 2
          ? movingAverage(view.visible.map((point) => point.value))
          : undefined
      }
      showTooltip={false}
      allowScroll={allowScroll}
      emptyLabel={t("detail.noSets")}
      ariaLabel={
        view.summary
          ? t("stats.chartAria", {
              from: formatMetricValue(view.summary.first, metric),
              to: formatMetricValue(view.summary.last, metric),
              unit: suffix,
            })
          : undefined
      }
    />
  );
}

function SummaryRow({
  summary,
  metric,
  unit,
  records,
}: {
  summary: SeriesSummary;
  metric: ProgressMetric;
  unit: Unit;
  records?: number;
}) {
  const { t } = useI18n();
  const suffix = metricUnit(metric, unit);
  const cells = [
    {
      label: t("stats.best"),
      value: formatMetricValue(summary.best, metric),
      unit: suffix,
    },
    {
      label: t("stats.average"),
      value: formatMetricValue(summary.average, metric),
      unit: suffix,
    },
    {
      label: t("stats.trend"),
      value:
        summary.perMonth != null
          ? formatMetricDelta(summary.perMonth, metric)
          : "—",
      unit:
        summary.perMonth != null
          ? `${suffix}${t("stats.perMonthUnit")}`
          : "",
    },
    {
      label: t("detail.sessions"),
      value: String(summary.sessions),
      unit: "",
    },
    ...(records != null
      ? [
          { label: t("stats.records"), value: String(records), unit: "" },
          {
            label: t("stats.change"),
            value:
              summary.changePct != null
                ? formatPercent(summary.changePct)
                : "—",
            unit: "",
          },
        ]
      : []),
  ];
  return (
    <div className={cn(styles.summary, records != null && styles.summaryWide)}>
      {cells.map((cell) => (
        <div key={cell.label} className={styles.summaryCell}>
          <p className={styles.summaryLabel}>{cell.label}</p>
          <p className={styles.summaryValue}>
            {cell.value}
            {cell.unit && <small> {cell.unit}</small>}
          </p>
        </div>
      ))}
    </div>
  );
}

function ProgressFullscreen({
  open,
  onClose,
  records,
  exerciseName,
  subtitle,
  unit,
  metrics,
  metric,
  onMetricChange,
  period,
  onPeriodChange,
  filter,
  onFilterChange,
}: {
  open: boolean;
  onClose: () => void;
  records: ExerciseSetRecord[];
  exerciseName: string;
  subtitle?: string;
  unit: Unit;
  metrics: ProgressMetric[];
  metric: ProgressMetric;
  onMetricChange: (metric: ProgressMetric) => void;
  period: PeriodKey;
  onPeriodChange: (period: PeriodKey) => void;
  filter: LoadFilter;
  /** Absent for bodyweight exercises (every set counts). */
  onFilterChange?: (filter: LoadFilter) => void;
}) {
  const { t, tn } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const [showTrend, setShowTrend] = useState(true);
  const [showAverage, setShowAverage] = useState(false);
  const [showRecords, setShowRecords] = useState(true);
  const [showSmoothing, setShowSmoothing] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const filterCaption = useFilterCaption(filter, unit);

  const view = useMemo(
    () => buildView(records, metric, unit, period, filter),
    [records, metric, unit, period, filter],
  );
  const suffix = metricUnit(metric, unit);
  const chartHeight =
    typeof window === "undefined"
      ? 300
      : Math.round(Math.min(Math.max(window.innerHeight * 0.42, 220), 420));

  const sessions = view.visible
    .map((point, index) => ({ point, index }))
    .reverse();

  return (
    <Fullscreen
      open={open}
      onClose={onClose}
      title={exerciseName}
      subtitle={subtitle}
      actions={
        <button
          type="button"
          aria-label={t("stats.info.title")}
          onClick={() => setInfoOpen(true)}
          className={styles.iconButtonLarge}
        >
          <IconInfo size={18} />
        </button>
      }
    >
      <div className={styles.fullscreen}>
        <MetricChips
          metrics={metrics}
          value={metric}
          onChange={(next) => {
            setActive(null);
            onMetricChange(next);
          }}
        />
        {onFilterChange && (
          <LoadFilterChips
            records={records}
            unit={unit}
            value={filter}
            onChange={(next) => {
              setActive(null);
              onFilterChange(next);
            }}
          />
        )}
        <p className={styles.caption}>
          {t(`stats.caption.${metric}`)}
          {onFilterChange && <> · {filterCaption}</>}
        </p>

        <Readout
          view={view}
          metric={metric}
          unit={unit}
          period={period}
          active={active}
        />

        <ProgressChart
          view={view}
          metric={metric}
          unit={unit}
          height={chartHeight}
          active={active}
          onActiveChange={setActive}
          onShowAll={() => onPeriodChange("all")}
          showTrend={showTrend}
          showAverage={showAverage}
          showRecords={showRecords}
          showSmoothing={showSmoothing}
          allowScroll={false}
        />

        <PeriodSwitch
          value={period}
          onChange={(next) => {
            setActive(null);
            onPeriodChange(next);
          }}
        />

        <div className={styles.tools}>
          <ToolToggle
            label={t("stats.tool.trend")}
            on={showTrend}
            onToggle={() => setShowTrend((value) => !value)}
            swatch="trend"
          />
          <ToolToggle
            label={t("stats.tool.average")}
            on={showAverage}
            onToggle={() => setShowAverage((value) => !value)}
            swatch="average"
          />
          <ToolToggle
            label={t("stats.tool.records")}
            on={showRecords}
            onToggle={() => setShowRecords((value) => !value)}
            swatch="records"
          />
          <ToolToggle
            label={t("stats.tool.smoothing")}
            on={showSmoothing}
            onToggle={() => setShowSmoothing((value) => !value)}
            swatch="smoothing"
          />
        </div>

        {view.summary && (
          <SummaryRow
            summary={view.summary}
            metric={metric}
            unit={unit}
            records={view.markers.size}
          />
        )}

        {sessions.length > 0 && (
          <div>
            <p className={styles.sessionsTitle}>{t("stats.sessionsList")}</p>
            <div className={styles.sessions}>
              {sessions.map(({ point, index }) => {
                const previous = index > 0 ? view.visible[index - 1] : null;
                const diff = previous ? point.value - previous.value : null;
                return (
                  <button
                    key={point.date}
                    type="button"
                    onClick={() => setActive(index === active ? null : index)}
                    className={cn(
                      styles.session,
                      index === active && styles.sessionActive,
                    )}
                  >
                    <span className={styles.sessionDate}>
                      {formatDay(point.date)}
                      <small>
                        {tn("count.sets", point.sets)}
                        {point.best?.weightKg != null &&
                          point.best.reps != null &&
                          metric !== "reps" &&
                          ` · ${roundWeight(kgToUnit(point.best.weightKg, unit))} × ${point.best.reps}`}
                      </small>
                    </span>
                    {view.markers.has(index) && (
                      <span className={styles.sessionPr}>
                        <IconTrophy size={11} />
                        {t("stats.pr")}
                      </span>
                    )}
                    <span className={styles.sessionValue}>
                      <span>
                        {formatMetricValue(point.value, metric)}
                        {suffix && <small> {suffix}</small>}
                      </span>
                      {diff != null && Math.abs(diff) > 1e-9 && (
                        <em
                          className={cn(
                            diff > 0 ? styles.diffUp : styles.diffDown,
                          )}
                        >
                          {formatMetricDelta(diff, metric)}
                        </em>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <MetricInfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        active={metric}
        metrics={metrics}
      />
    </Fullscreen>
  );
}

function ToolToggle({
  label,
  on,
  onToggle,
  swatch,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  swatch: "trend" | "average" | "records" | "smoothing";
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(styles.tool, on && styles.toolOn)}
    >
      <span className={cn(styles.swatch, styles[`swatch_${swatch}`])} />
      {label}
    </button>
  );
}
