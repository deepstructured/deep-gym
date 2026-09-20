"use client";

import { useI18n, type MessageKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { useUiMode, type UiMode } from "@/shared/lib/ui-mode";
import { IconAuto, IconCheck, IconMonitor, IconPhone } from "@/shared/ui";
import styles from "./ui-mode-toggle.module.scss";

export const UI_MODE_OPTIONS: {
  value: UiMode;
  labelKey: MessageKey;
  hintKey: MessageKey;
  icon: typeof IconAuto;
}[] = [
  {
    value: "auto",
    labelKey: "ui.mode.auto",
    hintKey: "ui.mode.autoHint",
    icon: IconAuto,
  },
  {
    value: "desktop",
    labelKey: "ui.mode.desktop",
    hintKey: "ui.mode.desktopHint",
    icon: IconMonitor,
  },
  {
    value: "mobile",
    labelKey: "ui.mode.mobile",
    hintKey: "ui.mode.mobileHint",
    icon: IconPhone,
  },
];

/** Compact segmented control for the desktop top bar. */
export function UiModeToggle() {
  const { t } = useI18n();
  const [mode, setMode] = useUiMode();

  return (
    <div
      role="group"
      aria-label={t("ui.mode.title")}
      className={styles.toggle}
    >
      {UI_MODE_OPTIONS.map(({ value, labelKey, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          title={t(labelKey)}
          aria-label={t(labelKey)}
          onClick={() => setMode(value)}
          className={cn(styles.option, mode === value && styles.optionActive)}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

/** Full list for the Settings sheet — same options, with descriptions. */
export function UiModeOptions({ onPicked }: { onPicked?: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useUiMode();

  return (
    <div className={styles.list}>
      {UI_MODE_OPTIONS.map(({ value, labelKey, hintKey, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => {
            setMode(value);
            onPicked?.();
          }}
          className={cn(styles.row, mode === value && styles.rowActive)}
        >
          <span className={styles.rowIcon}>
            <Icon size={18} />
          </span>
          <span className={styles.rowText}>
            <span className={styles.rowLabel}>{t(labelKey)}</span>
            <span className={styles.rowHint}>{t(hintKey)}</span>
          </span>
          {mode === value && <IconCheck size={18} className={styles.rowMark} />}
        </button>
      ))}
    </div>
  );
}
