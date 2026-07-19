"use client";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { Avatar } from "@/shared/ui";
import { PRESET_AVATARS } from "../model/presets";
import styles from "./avatar-preset-grid.module.scss";

interface AvatarPresetGridProps {
  value: string | null;
  onSelect: (url: string | null) => void;
  disabled?: boolean;
  size?: number;
  className?: string;
}

/** Controlled grid shared by Settings and the onboarding profile step. */
export function AvatarPresetGrid({
  value,
  onSelect,
  disabled,
  size = 48,
  className,
}: AvatarPresetGridProps) {
  const { t } = useI18n();

  return (
    <div className={cn(styles.grid, className)}>
      {PRESET_AVATARS.map((preset) => {
        const selected = value === preset.url;
        return (
          <button
            key={preset.id}
            type="button"
            aria-label={t(preset.labelKey)}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onSelect(preset.url)}
            className={cn(styles.preset, selected && styles.selected)}
          >
            <Avatar src={preset.url} size={size} alt="" />
          </button>
        );
      })}
    </div>
  );
}
