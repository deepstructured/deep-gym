"use client";

import { focusManager } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { todayISO, toISODate } from "./dates";

/** Re-read the device calendar on resume as the OS may have suspended timers. */
export function useLocalToday(): string {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      clearTimeout(timer);
      const now = new Date();
      setToday(toISODate(now));
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    }
    refresh();
    const unsubscribe = focusManager.subscribe(focused => {
      if (focused) refresh();
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  return today;
}
