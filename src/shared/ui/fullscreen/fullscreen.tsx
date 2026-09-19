"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { IconClose } from "../icons/icons";
import styles from "./fullscreen.module.scss";

interface FullscreenProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Extra header controls rendered before the close button. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Full-viewport focus mode (e.g. an expanded chart). Locks page scroll,
 *  closes on Escape and respects the device safe areas. */
export function Fullscreen({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
  className,
}: FullscreenProps) {
  const { t } = useI18n();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => panelRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = original;
      previousFocus?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cn(styles.screen, className)}
    >
      <header className={styles.header}>
        <div className={styles.titles}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className={styles.close}
        >
          <IconClose size={18} />
        </button>
      </header>
      <div className={styles.body}>{children}</div>
    </div>,
    document.body,
  );
}
