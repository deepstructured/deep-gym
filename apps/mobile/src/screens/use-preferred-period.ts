import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import type { LookbackPeriod } from "./period-range";

const KEY = "deepgym-chart-period";
const PERIODS: LookbackPeriod[] = ["1m", "3m", "6m", "1y", "all"];

/** Home and Progress share the same remembered chart period, as in the PWA. */
export function usePreferredPeriod(): [LookbackPeriod, (period: LookbackPeriod) => void] {
  const [period, setPeriod] = useState<LookbackPeriod>("3m");
  useFocusEffect(useCallback(() => {
    let active = true;
    void AsyncStorage.getItem(KEY).then((stored) => {
      if (active && PERIODS.includes(stored as LookbackPeriod)) setPeriod(stored as LookbackPeriod);
    }).catch(() => {});
    return () => { active = false; };
  }, []));

  const change = useCallback((next: LookbackPeriod) => {
    setPeriod(next);
    void AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);
  return [period, change];
}
