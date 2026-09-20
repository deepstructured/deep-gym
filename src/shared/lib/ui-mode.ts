"use client";

import { useCallback, useSyncExternalStore } from "react";

/** What the user picked in Settings. "auto" follows the viewport width. */
export const UI_MODES = ["auto", "mobile", "desktop"] as const;
export type UiMode = (typeof UI_MODES)[number];

/** What is actually rendered once "auto" is resolved. */
export type LayoutMode = "mobile" | "desktop";

export const UI_MODE_STORAGE_KEY = "deepgym-ui-mode";

/** Below this the phone layout is the only sensible one. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

/** Forced desktop on a narrow screen needs a wider viewport to be usable. */
const FORCED_DESKTOP_VIEWPORT = 1180;

export function isUiMode(value: unknown): value is UiMode {
  return (
    typeof value === "string" && (UI_MODES as readonly string[]).includes(value)
  );
}

/**
 * Runs blocking in <head> so `data-ui` is on <html> before the first paint —
 * the whole shell (dock vs tab bar, widths, sheet vs dialog) is switched by
 * CSS alone, so there is never a flash of the wrong layout. Keep it in sync
 * with `resolve()` below; it is deliberately dependency-free and self-healing.
 */
export const UI_MODE_SCRIPT = `(function(){var d=document.documentElement;var m="auto";try{var s=localStorage.getItem("${UI_MODE_STORAGE_KEY}");if(s==="mobile"||s==="desktop"||s==="auto")m=s}catch(e){}var w=m==="desktop"||(m==="auto"&&window.matchMedia("${DESKTOP_QUERY}").matches);d.dataset.ui=w?"desktop":"mobile";d.dataset.uiMode=m})();`;

// ── Store ──────────────────────────────────────────────────────────
// A viewer-wide, per-device choice (not on the profile: the same account is
// used from a phone and a desktop). Mirrors src/shared/lib/preference.ts, but
// also tracks the media query and writes the <html> attributes.

const listeners = new Set<() => void>();
let mode: UiMode = "auto";
let layout: LayoutMode = "mobile";
let started = false;

function resolve(next: UiMode): LayoutMode {
  if (next !== "auto") return next;
  return window.matchMedia(DESKTOP_QUERY).matches ? "desktop" : "mobile";
}

/** Widen the viewport when desktop is forced on a phone, and hand it back
 *  otherwise. Doing this here rather than in the blocking script keeps the
 *  script independent of where Next renders its own viewport meta tag. */
function syncViewport() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return;
  const wants =
    layout === "desktop" && window.screen.width < 1024
      ? `width=${FORCED_DESKTOP_VIEWPORT}, viewport-fit=cover`
      : "width=device-width, initial-scale=1, viewport-fit=cover";
  if (meta.content !== wants) meta.content = wants;
}

function publish() {
  const root = document.documentElement;
  root.dataset.ui = layout;
  root.dataset.uiMode = mode;
  syncViewport();
  listeners.forEach((listener) => listener());
}

function start() {
  if (started) return;
  started = true;
  try {
    const stored = window.localStorage.getItem(UI_MODE_STORAGE_KEY);
    if (isUiMode(stored)) mode = stored;
  } catch {
    // storage unavailable — "auto" still works
  }
  layout = resolve(mode);
  window.matchMedia(DESKTOP_QUERY).addEventListener("change", () => {
    if (mode !== "auto") return;
    const next = resolve(mode);
    if (next === layout) return;
    layout = next;
    publish();
  });
  publish();
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setUiMode(next: UiMode) {
  if (next === mode) return;
  mode = next;
  layout = resolve(next);
  try {
    window.localStorage.setItem(UI_MODE_STORAGE_KEY, next);
  } catch {
    // not persisted in private mode — the session still switches
  }
  publish();
}

/** The stored choice, for the Settings row and the top-bar toggle. */
export function useUiMode(): [UiMode, (next: UiMode) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => mode,
    () => "auto" as UiMode,
  );
  return [value, useCallback(setUiMode, [])];
}

/**
 * The resolved layout, for the few places that need a genuinely different
 * React tree. Everything that can be switched with CSS should key off
 * `html[data-ui="desktop"]` instead — that has no hydration step at all.
 * Renders as "mobile" on the server and corrects itself right after mount.
 */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(
    subscribe,
    () => layout,
    () => "mobile" as LayoutMode,
  );
}
