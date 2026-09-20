"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useExercises } from "@/entities/exercise";
import { useI18n, type MessageKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { useLayoutMode } from "@/shared/lib/ui-mode";
import {
  IconChart,
  IconDumbbell,
  IconHistory,
  IconHome,
  IconLibrary,
  IconPlus,
  IconScale,
  IconSearch,
  IconSettings,
  IconTemplate,
  IconWidgets,
} from "@/shared/ui";
import styles from "./command-palette.module.scss";

type IconComponent = typeof IconHome;

interface Command {
  id: string;
  label: string;
  group: "actions" | "navigate" | "exercises";
  icon: IconComponent;
  href: string;
}

const NAVIGATE: { href: string; labelKey: MessageKey; icon: IconComponent }[] =
  [
    { href: "/", labelKey: "nav.home", icon: IconHome },
    { href: "/history", labelKey: "nav.history", icon: IconHistory },
    { href: "/progress", labelKey: "nav.progress", icon: IconChart },
    { href: "/exercises", labelKey: "exercises.title", icon: IconLibrary },
    { href: "/templates", labelKey: "templates.title", icon: IconTemplate },
    { href: "/settings", labelKey: "nav.settings", icon: IconSettings },
  ];

const ACTIONS: { href: string; labelKey: MessageKey; icon: IconComponent }[] = [
  { href: "/workouts/new", labelKey: "home.startWorkout", icon: IconPlus },
  { href: "/templates/new", labelKey: "templates.new", icon: IconTemplate },
  {
    href: "/settings?open=weight",
    labelKey: "bodyWeight.record",
    icon: IconScale,
  },
  { href: "/?edit=1", labelKey: "dashboard.customize", icon: IconWidgets },
];

const GROUP_LABEL: Record<Command["group"], MessageKey> = {
  actions: "palette.actions",
  navigate: "palette.navigate",
  exercises: "exercises.title",
};

/** How many exercise matches to offer before the list gets unwieldy. */
const EXERCISE_LIMIT = 6;

const OPEN_EVENT = "deepgym:open-command-palette";

/** Open the palette from anywhere (the top bar's search button). */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/**
 * Desktop command palette (⌘K / Ctrl+K): jump to a page, start a workout or
 * open an exercise without leaving the keyboard. Mounted by AppShell, so it
 * is available on every screen; it does nothing in the phone layout, where
 * the tab bar is already one thumb away.
 */
export function CommandPalette() {
  const router = useRouter();
  const { t } = useI18n();
  const layoutMode = useLayoutMode();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Only fetched once the palette has been opened.
  const { data: exercises } = useExercises(open);

  useEffect(() => {
    if (layoutMode !== "desktop") return;
    function reset() {
      setQuery("");
      setActive(0);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey))
        return;
      event.preventDefault();
      reset();
      setOpen((current) => !current);
    }
    function onOpen() {
      reset();
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [layoutMode]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previousFocus?.focus();
    };
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const needle = query.trim().toLowerCase();
    const matches = (label: string) =>
      needle === "" || label.toLowerCase().includes(needle);

    const list: Command[] = [];
    for (const item of ACTIONS) {
      const label = t(item.labelKey);
      if (matches(label)) {
        list.push({ ...item, id: `action:${item.href}`, group: "actions", label });
      }
    }
    for (const item of NAVIGATE) {
      const label = t(item.labelKey);
      if (matches(label)) {
        list.push({
          ...item,
          id: `nav:${item.href}`,
          group: "navigate",
          label,
        });
      }
    }
    // Exercises are only worth listing once there is something to match on.
    if (needle !== "") {
      for (const exercise of exercises ?? []) {
        if (list.length >= ACTIONS.length + NAVIGATE.length + EXERCISE_LIMIT) {
          break;
        }
        if (!matches(exercise.name)) continue;
        list.push({
          id: `exercise:${exercise.id}`,
          label: exercise.name,
          group: "exercises",
          icon: IconDumbbell,
          href: `/exercises/${exercise.id}`,
        });
      }
    }
    return list;
  }, [query, exercises, t]);

  // Keep the highlight inside the list as it shrinks while typing.
  const activeIndex = Math.min(active, Math.max(commands.length - 1, 0));

  function run(command: Command | undefined) {
    if (!command) return;
    setOpen(false);
    router.push(command.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (commands.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next =
        (activeIndex + step + commands.length) % commands.length;
      setActive(next);
      listRef.current
        ?.querySelectorAll("button")
        [next]?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      run(commands[activeIndex]);
    }
  }

  if (!open) return null;

  let lastGroup: Command["group"] | null = null;

  return (
    <div className={styles.overlay} onKeyDown={onKeyDown}>
      <div
        aria-hidden="true"
        className={styles.backdrop}
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("palette.title")}
        className={styles.panel}
      >
        <div className={styles.searchRow}>
          <IconSearch size={18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            placeholder={t("palette.placeholder")}
            aria-label={t("palette.placeholder")}
            className={styles.search}
          />
          <kbd className={styles.kbd}>esc</kbd>
        </div>

        <div ref={listRef} className={styles.list}>
          {commands.length === 0 && (
            <p className={styles.empty}>{t("palette.empty")}</p>
          )}
          {commands.map((command, index) => {
            const Icon = command.icon;
            const newGroup = command.group !== lastGroup;
            lastGroup = command.group;
            return (
              <div key={command.id}>
                {newGroup && (
                  <p className={styles.groupLabel}>
                    {t(GROUP_LABEL[command.group])}
                  </p>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(command)}
                  className={cn(
                    styles.item,
                    index === activeIndex && styles.itemActive,
                  )}
                >
                  <Icon size={17} />
                  <span className={styles.itemLabel}>{command.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
