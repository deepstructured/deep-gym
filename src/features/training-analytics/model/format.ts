/** 12 345 → "12.3k", 1 234 567 → "1.23M"; small values stay exact. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000, 2)}M`;
  if (abs >= 10_000) return `${trim(value / 1000, 1)}k`;
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function trim(value: number, digits: number): string {
  return String(Math.round(value * 10 ** digits) / 10 ** digits);
}
