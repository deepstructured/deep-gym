import { useMemo, useState } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";
import { colors, fonts } from "../theme";

const DAY_MS = 86_400_000;

function dayNumber(date: string, fallback: number): number {
  const time = Date.parse(date.length === 10 ? `${date}T12:00:00Z` : date);
  return Number.isFinite(time) ? time / DAY_MS : fallback;
}

function niceStep(range: number, count: number): number {
  const raw = Math.max(range / count, 1e-9);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;
}

function niceDomain(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.max(Math.abs(max) * 0.1, 1);
  const paddedLow = min - range * 0.08;
  const paddedHigh = max + range * 0.08;
  const step = niceStep(paddedHigh - paddedLow, 3);
  const low = Math.floor(paddedLow / step) * step;
  const high = Math.ceil(paddedHigh / step) * step;
  const ticks: number[] = [];
  for (let value = low; value <= high + step / 2; value += step) ticks.push(Math.round(value * 1000) / 1000);
  return { low, high: high === low ? low + step : high, ticks };
}

/** Same monotone cubic curve as the PWA chart; never overshoots a session. */
function monotonePath(points: { x: number; y: number }[]): string {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  const sign = (value: number) => value < 0 ? -1 : value > 0 ? 1 : 0;
  const tangents = new Array<number>(points.length).fill(0);
  for (let index = 1; index < points.length - 1; index++) {
    const left = points[index].x - points[index - 1].x;
    const right = points[index + 1].x - points[index].x;
    const before = (points[index].y - points[index - 1].y) / (left || 1e-9);
    const after = (points[index + 1].y - points[index].y) / (right || 1e-9);
    const projected = (before * right + after * left) / (left + right || 1e-9);
    tangents[index] = (sign(before) + sign(after)) * Math.min(Math.abs(before), Math.abs(after), 0.5 * Math.abs(projected)) || 0;
  }
  if (points.length === 2) {
    const slope = (points[1].y - points[0].y) / (points[1].x - points[0].x || 1e-9);
    tangents[0] = slope;
    tangents[1] = slope;
  } else {
    const startWidth = points[1].x - points[0].x;
    const end = points.length - 1;
    const endWidth = points[end].x - points[end - 1].x;
    tangents[0] = startWidth ? (3 * (points[1].y - points[0].y) / startWidth - tangents[1]) / 2 : tangents[1];
    tangents[end] = endWidth ? (3 * (points[end].y - points[end - 1].y) / endWidth - tangents[end - 1]) / 2 : tangents[end - 1];
  }
  let path = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index];
    const b = points[index + 1];
    const third = (b.x - a.x) / 3;
    path += ` C${(a.x + third).toFixed(1)},${(a.y + tangents[index] * third).toFixed(1)} ${(b.x - third).toFixed(1)},${(b.y - tangents[index + 1] * third).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }
  return path;
}

function axisValue(value: number): string {
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString("en-US");
  return String(Math.round(value * 10) / 10);
}

export interface ProgressTrendLineProps {
  values: number[];
  color?: string;
  height?: number;
  chartId: string;
  activeIndex?: number | null;
  onActiveChange?: (index: number | null) => void;
  framed?: boolean;
  dates?: string[];
  locale?: string;
  markers?: ReadonlySet<number>;
  showTrend?: boolean;
  showAverage?: boolean;
  showRecords?: boolean;
  showSmoothing?: boolean;
}

/** PWA-style date-scaled chart with session dots and optional record rings. */
export function ProgressTrendLine({ values, color = colors.lime, height = 148, chartId, activeIndex = null, onActiveChange, framed = false, dates, locale, markers, showTrend = false, showAverage = false, showRecords = true, showSmoothing = false }: ProgressTrendLineProps) {
  const [width, setWidth] = useState(300);
  const layout = useMemo(() => {
    if (!values.length) return null;
    const domain = niceDomain(values);
    const longest = Math.max(...domain.ticks.map((value) => axisValue(value).length));
    const gutter = framed ? Math.max(24, longest * 5.8 + 10) : 7;
    const left = framed ? 8 : 7;
    const right = Math.max(left + 1, width - gutter);
    const top = framed ? 10 : 16;
    const bottom = height - (framed ? 22 : 12);
    const times = values.map((_, index) => dates?.[index] ? dayNumber(dates[index], index) : index);
    const firstTime = times[0];
    const lastTime = times[times.length - 1];
    const span = lastTime - firstTime;
    const x = (time: number) => span ? left + (time - firstTime) / span * (right - left) : (left + right) / 2;
    const y = (value: number) => bottom - (value - domain.low) / (domain.high - domain.low) * (bottom - top);
    const points = values.map((value, index) => ({ x: x(times[index]), y: y(value), value }));
    const line = monotonePath(points);
    const area = points.length > 1 ? `${line} L${points.at(-1)!.x.toFixed(1)},${bottom} L${points[0].x.toFixed(1)},${bottom} Z` : "";
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const meanTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const numerator = times.reduce((sum, time, index) => sum + (time - meanTime) * (values[index] - average), 0);
    const denominator = times.reduce((sum, time) => sum + (time - meanTime) ** 2, 0);
    const slope = denominator > 0 ? numerator / denominator : 0;
    const trend = values.length > 1 && denominator > 0 ? {
      x1: points[0].x, x2: points.at(-1)!.x,
      y1: y(average + slope * (firstTime - meanTime)),
      y2: y(average + slope * (lastTime - meanTime)),
    } : null;
    const smoothing = values.map((_, index) => {
      const range = values.slice(Math.max(0, index - 2), index + 1);
      return range.reduce((sum, value) => sum + value, 0) / range.length;
    });
    return { domain, left, right, top, bottom, points, line, area, averageY: y(average), trend, smoothingPath: monotonePath(smoothing.map((value, index) => ({ x: points[index].x, y: y(value) }))), times, firstTime, lastTime, span };
  }, [dates, height, values, width, framed]);

  function onLayout(event: LayoutChangeEvent) {
    const next = Math.max(1, event.nativeEvent.layout.width);
    if (Math.abs(width - next) > 1) setWidth(next);
  }
  if (!layout) return <View style={{ height }} />;
  const last = layout.points.length - 1;
  const selected = activeIndex != null ? layout.points[activeIndex] : null;
  const gradientId = `${chartId}-area`;
  const backgroundId = `${chartId}-well`;
  const formatDate = (time: number) => new Date(time * DAY_MS).toLocaleDateString(locale || undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  const indexAt = (locationX: number) => layout.points.reduce((best, point, index) => Math.abs(point.x - locationX) < Math.abs(layout.points[best].x - locationX) ? index : best, 0);

  return <Pressable
    onLayout={onLayout}
    onPress={onActiveChange ? (event) => {
      const nearest = indexAt(event.nativeEvent.locationX);
      onActiveChange(activeIndex === nearest ? null : nearest);
    } : undefined}
    onTouchMove={onActiveChange ? (event) => {
      const nearest = indexAt(event.nativeEvent.locationX);
      if (nearest !== activeIndex) onActiveChange(nearest);
    } : undefined}
    accessibilityRole={onActiveChange ? "button" : undefined}
    style={{ height, width: "100%", borderRadius: framed ? 22 : 0, borderWidth: framed ? 1 : 0, borderColor: framed ? "rgba(255,255,255,0.05)" : "transparent", overflow: "hidden", backgroundColor: framed ? "#11121b" : "transparent" }}
  >
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} pointerEvents="none">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color === colors.lime ? colors.lime : "#4054d6"} stopOpacity={color === colors.lime ? 0.22 : 0.34} />
          <Stop offset="1" stopColor={color === colors.lime ? colors.lime : "#182788"} stopOpacity={0} />
        </LinearGradient>
        <RadialGradient id={backgroundId} cx="50%" cy="110%" rx="75%" ry="70%" fx="50%" fy="110%">
          <Stop offset="0" stopColor="#4054d6" stopOpacity={0.26} />
          <Stop offset="1" stopColor="#11121b" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {framed ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${backgroundId})`} /> : null}
      {framed ? layout.domain.ticks.map((tick) => {
        const y = layout.bottom - (tick - layout.domain.low) / (layout.domain.high - layout.domain.low) * (layout.bottom - layout.top);
        return <Line key={`grid-${tick}`} x1={layout.left} x2={layout.right} y1={y} y2={y} stroke="#fff" strokeOpacity={0.12} strokeWidth={1} strokeDasharray="1 6" />;
      }) : null}
      {framed ? layout.domain.ticks.map((tick) => {
        const y = layout.bottom - (tick - layout.domain.low) / (layout.domain.high - layout.domain.low) * (layout.bottom - layout.top);
        return <SvgText key={`axis-${tick}`} x={width - 4} y={y + 3.5} fill="#878792" fillOpacity={0.55} fontFamily={fonts.dot} fontSize={9.5} textAnchor="end">{axisValue(tick)}</SvgText>;
      }) : null}
      {layout.area ? <Path d={layout.area} fill={`url(#${gradientId})`} /> : null}
      {showAverage && layout.points.length > 1 ? <Line x1={layout.left} x2={layout.right} y1={layout.averageY} y2={layout.averageY} stroke={colors.lime} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="2 5" /> : null}
      {showTrend && layout.trend ? <Line {...layout.trend} stroke="#8c9bff" strokeOpacity={0.85} strokeWidth={1.4} strokeDasharray="5 5" /> : null}
      {showSmoothing && layout.points.length > 2 ? <Path d={layout.smoothingPath} fill="none" stroke="#f567b5" strokeOpacity={0.85} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /> : null}
      <Path d={layout.line} fill="none" stroke={color} strokeOpacity={0.08} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={layout.line} fill="none" stroke={color} strokeOpacity={selected ? 0.75 : 0.95} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      {layout.points.map((point, index) => {
        const isLast = index === last;
        const record = showRecords && (markers?.has(index) ?? false);
        if (layout.points.length > 40 && !record && !isLast) return null;
        return <G key={`point-${index}`}>
          {record ? <Circle cx={point.x} cy={point.y} r={5.2} fill="none" stroke={colors.lime} strokeOpacity={0.9} strokeWidth={1.6} /> : null}
          {isLast ? <Circle cx={point.x} cy={point.y} r={7} fill={colors.lime} fillOpacity={0.16} /> : null}
          <Circle cx={point.x} cy={point.y} r={isLast ? 3.6 : 2.5} fill={isLast ? colors.lime : color} fillOpacity={isLast ? 1 : 0.72} />
        </G>;
      })}
      {selected ? <>
        <Line x1={selected.x} x2={selected.x} y1={layout.top - 6} y2={layout.bottom} stroke="#fff" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 4" />
        <Circle cx={selected.x} cy={selected.y} r={9} fill={colors.lime} fillOpacity={0.18} />
        <Circle cx={selected.x} cy={selected.y} r={4.6} fill={colors.lime} stroke="#0a0a0c" strokeWidth={2} />
      </> : null}
      {framed && dates?.length ? <>
        <SvgText x={layout.left} y={height - 5} fill="#777988" fillOpacity={0.65} fontFamily={fonts.regular} fontSize={10}>{formatDate(layout.firstTime)}</SvgText>
        {layout.right - layout.left > 220 && layout.span > 0 ? <SvgText x={(layout.left + layout.right) / 2} y={height - 5} fill="#777988" fillOpacity={0.65} fontFamily={fonts.regular} fontSize={10} textAnchor="middle">{formatDate((layout.firstTime + layout.lastTime) / 2)}</SvgText> : null}
        {layout.span > 0 ? <SvgText x={layout.right} y={height - 5} fill="#777988" fillOpacity={0.65} fontFamily={fonts.regular} fontSize={10} textAnchor="end">{formatDate(layout.lastTime)}</SvgText> : null}
      </> : null}
    </Svg>
  </Pressable>;
}
