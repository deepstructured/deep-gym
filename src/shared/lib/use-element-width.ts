"use client";

import { useCallback, useLayoutEffect, useState } from "react";

/** Live content width of an element (ResizeObserver) via a callback ref, so
 *  it keeps working when the measured node mounts later or is replaced.
 *  Returns `fallback` until the first measurement, e.g. during SSR. */
export function useElementWidth<T extends HTMLElement>(
  fallback = 320,
): [ref: (node: T | null) => void, width: number] {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    if (!node) return;
    setWidth(node.clientWidth || fallback);
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setWidth(Math.round(next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, fallback]);

  const ref = useCallback((next: T | null) => setNode(next), []);
  return [ref, width];
}
