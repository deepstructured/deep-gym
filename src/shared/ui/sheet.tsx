"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { IconClose } from "./icons";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/** Bottom sheet modal. */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const { t } = useI18n();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const original = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const focusableSelector = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    const frame = requestAnimationFrame(() => {
      const first = panel?.querySelector<HTMLElement>(focusableSelector);
      (first ?? panel)?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = original;
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-md animate-sheet-up rounded-t-[2rem] border-t border-line/60 bg-surface",
          "max-h-[88dvh] overflow-y-auto px-5 pt-3 pb-8 safe-bottom",
          className,
        )}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        {title != null && (
          <div className="mb-4 flex items-center justify-between">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-raised text-muted"
            >
              <IconClose size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  loading?: boolean;
}

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  loading,
}: ConfirmSheetProps) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {message && <p className="mb-5 text-[15px] text-muted">{message}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-12 flex-1 rounded-full border border-line bg-raised font-medium"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="h-12 flex-1 rounded-full bg-flame font-semibold text-white disabled:opacity-50"
        >
          {confirmLabel ?? t("common.delete")}
        </button>
      </div>
    </Sheet>
  );
}
