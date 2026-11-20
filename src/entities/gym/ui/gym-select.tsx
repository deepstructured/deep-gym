"use client";

import { cn } from "@/shared/lib/cn";
import { useI18n } from "@/shared/i18n";
import { IconChevronDown, IconDumbbell } from "@/shared/ui";
import type { Gym } from "@deepgym/core/types";
import styles from "./gym-select.module.scss";

export function GymSelect({ gyms, value, filter = false, className, onChange }: {
  gyms: Gym[];
  value: string;
  filter?: boolean;
  className?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const missing = value && value !== "none" && !gyms.some(gym => gym.id === value);

  return (
    <label className={cn(styles.control, className)}>
      <IconDumbbell size={17} />
      <span>{t("gym.label")}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value="">{t(filter ? "gym.all" : "gym.none")}</option>
        {filter && <option value="none">{t("gym.none")}</option>}
        {missing && <option value={value} disabled>{t("gym.unavailable")}</option>}
        {gyms.map(gym => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
      </select>
      <IconChevronDown size={15} />
    </label>
  );
}
