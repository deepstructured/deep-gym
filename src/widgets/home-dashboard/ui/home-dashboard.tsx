"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useProfile } from "@/entities/user";
import { useAllWorkouts, useWorkoutCount } from "@/entities/workout";
import { BodyWeightTracker } from "@/features/body-weight";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import {
  IconCheck,
  IconMinus,
  IconPlus,
  IconWidgets,
  Sheet,
} from "@/shared/ui";
import {
  WIDGETS,
  newWidgetId,
  packLayout,
  type HomeWidget,
  type PlacedWidget,
  type WidgetConfig,
  type WidgetSize,
  type WidgetType,
} from "../model/layout";
import { useHomeLayout } from "../model/use-home-layout";
import { HomeDataProvider, type HomeData } from "./home-data";
import { TILES, widgetTitleKey } from "./tiles";
import { WidgetGallery } from "./widget-gallery";
import styles from "./home-dashboard.module.scss";

/** Dragging reorders live, so dnd-kit must not add its own transforms. */
const noShift = () => null;
const LONG_PRESS_MS = 550;

interface HomeDashboardProps {
  /** Edit mode is owned by the page so its header can toggle it too. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

/**
 * The customizable home grid. Tiles pack into two columns like iOS
 * widgets; edit mode (long-press a tile, the header icon or "Customize")
 * lets the user drag, resize, remove and add widgets. The layout syncs
 * through the profile.
 */
export function HomeDashboard({
  editing,
  onEditingChange: setEditing,
}: HomeDashboardProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { data: profile } = useProfile();
  const { data: workouts, isSuccess } = useAllWorkouts();
  const { data: workoutCount } = useWorkoutCount();
  const { layout, save, reset, isCustom } = useHomeLayout();

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [dragOrder, setDragOrder] = useState<HomeWidget[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const lastOverId = useRef<string | null>(null);

  const widgets = dragOrder ?? layout.widgets;
  const placed = useMemo(() => packLayout(widgets), [widgets]);

  // Settings → "Home screen" deep-links here with ?edit=1.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("edit") === "1") {
      setEditing(true);
      router.replace("/", { scroll: false });
    }
  }, [router, setEditing]);

  // Scroll a freshly added widget into view.
  useEffect(() => {
    if (!addedId) return;
    const frame = requestAnimationFrame(() =>
      document
        .querySelector(`[data-widget-id="${addedId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
    const timer = setTimeout(() => setAddedId(null), 1600);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [addedId]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 160, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const data: HomeData = {
    profile,
    unit: profile?.unit ?? "kg",
    workouts: workouts ?? [],
    workoutsLoaded: isSuccess,
    workoutCount,
    openWeightSheet: () => setWeightOpen(true),
  };

  function commit(next: HomeWidget[]) {
    save({ version: 1, widgets: next });
  }

  function patchWidget(id: string, patch: Partial<HomeWidget>) {
    commit(
      layout.widgets.map((widget) =>
        widget.id === id ? { ...widget, ...patch } : widget,
      ),
    );
  }

  function addWidget(type: WidgetType) {
    const widget: HomeWidget = {
      id: newWidgetId(type),
      type,
      size: WIDGETS[type].sizes[0],
    };
    commit([...layout.widgets, widget]);
    setGalleryOpen(false);
    setAddedId(widget.id);
  }

  function onDragStart({ active }: DragStartEvent) {
    lastOverId.current = null;
    setActiveId(String(active.id));
    setDragOrder(layout.widgets);
    navigator.vibrate?.(8);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const overId = String(over.id);
    if (overId === active.id) {
      lastOverId.current = null;
      return;
    }
    // After a live swap of differently sized tiles the pointer can still be
    // over the same neighbour — don't swap straight back.
    if (overId === lastOverId.current) return;
    lastOverId.current = overId;
    setDragOrder((current) => {
      const list = current ?? layout.widgets;
      const from = list.findIndex((widget) => widget.id === active.id);
      const to = list.findIndex((widget) => widget.id === overId);
      return from < 0 || to < 0 ? list : arrayMove(list, from, to);
    });
  }

  function onDragEnd() {
    if (dragOrder) commit(dragOrder);
    setDragOrder(null);
    setActiveId(null);
  }

  const activePlaced = placed.find((item) => item.widget.id === activeId);

  return (
    <HomeDataProvider value={data}>
      {editing && (
        <div className={styles.editBar}>
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className={styles.editAdd}
          >
            <IconPlus size={16} />
            {t("dashboard.addWidget")}
          </button>
          {isCustom && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className={styles.editReset}
            >
              {t("dashboard.reset")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(false)}
            className={styles.editDone}
          >
            <IconCheck size={16} />
            {t("dashboard.done")}
          </button>
        </div>
      )}

      <div className={styles.container}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setDragOrder(null);
            setActiveId(null);
          }}
        >
          <SortableContext
            items={widgets.map((widget) => widget.id)}
            strategy={noShift}
          >
            <div className={cn(styles.grid, editing && styles.editing)}>
              {placed.map((item, index) => (
                <SortableTile
                  key={item.widget.id}
                  placed={item}
                  index={index}
                  editing={editing}
                  highlighted={item.widget.id === addedId}
                  onLongPress={() => setEditing(true)}
                  onRemove={() =>
                    commit(
                      layout.widgets.filter(
                        (widget) => widget.id !== item.widget.id,
                      ),
                    )
                  }
                  onResize={(size) => patchWidget(item.widget.id, { size })}
                  onConfigChange={(config) =>
                    patchWidget(item.widget.id, { config })
                  }
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
            {activePlaced && (
              <div className={styles.overlay}>
                <TileContent placed={activePlaced} onConfigChange={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {widgets.length === 0 && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setGalleryOpen(true);
            }}
            className={styles.emptyGrid}
          >
            <IconWidgets size={22} />
            {t("dashboard.empty")}
          </button>
        )}
      </div>

      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={styles.customize}
        >
          <IconWidgets size={16} />
          {t("dashboard.customize")}
        </button>
      )}

      <WidgetGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        widgets={layout.widgets}
        onAdd={addWidget}
      />

      <Sheet
        open={weightOpen}
        onClose={() => setWeightOpen(false)}
        title={t("bodyWeight.title")}
      >
        <BodyWeightTracker
          bare
          allowTimestampEdit
          onLogged={() => setWeightOpen(false)}
        />
      </Sheet>

      <Sheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t("dashboard.resetTitle")}
      >
        <p className={styles.resetMessage}>{t("dashboard.resetMessage")}</p>
        <div className={styles.resetRow}>
          <button
            type="button"
            onClick={() => setConfirmReset(false)}
            className={styles.resetCancel}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setConfirmReset(false);
            }}
            className={styles.resetConfirm}
          >
            {t("dashboard.reset")}
          </button>
        </div>
      </Sheet>
    </HomeDataProvider>
  );
}

function effectiveSize(item: PlacedWidget): {
  size: WidgetSize;
  wide: boolean;
} {
  const definition = WIDGETS[item.widget.type];
  if (item.stretched) {
    return definition.sizes.includes("m")
      ? { size: "m", wide: false }
      : { size: "s", wide: true };
  }
  return { size: item.widget.size, wide: false };
}

function TileContent({
  placed,
  onConfigChange,
}: {
  placed: PlacedWidget;
  onConfigChange: (config: WidgetConfig) => void;
}) {
  const { component: Component } = TILES[placed.widget.type];
  const { size, wide } = effectiveSize(placed);
  return (
    <Component
      widget={placed.widget}
      size={size}
      wide={wide}
      onConfigChange={onConfigChange}
    />
  );
}

function SortableTile({
  placed,
  index,
  editing,
  highlighted,
  onLongPress,
  onRemove,
  onResize,
  onConfigChange,
}: {
  placed: PlacedWidget;
  index: number;
  editing: boolean;
  highlighted: boolean;
  onLongPress: () => void;
  onRemove: () => void;
  onResize: (size: WidgetSize) => void;
  onConfigChange: (config: WidgetConfig) => void;
}) {
  const { t } = useI18n();
  const { widget } = placed;
  const definition = WIDGETS[widget.type];
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: widget.id,
    disabled: !editing,
  });
  const longPress = useLongPress(onLongPress, !editing);

  return (
    <div
      ref={setNodeRef}
      data-widget-id={widget.id}
      className={cn(
        styles.cell,
        editing && styles.cellEditing,
        index % 2 === 1 && styles.cellOdd,
        isDragging && styles.cellDragging,
        highlighted && styles.cellAdded,
      )}
      style={{
        gridColumn: `span ${placed.columns}`,
        gridRow: `span ${placed.rows}`,
      }}
      {...longPress}
    >
      <div className={styles.cellInner} inert={editing || undefined}>
        <TileContent placed={placed} onConfigChange={onConfigChange} />
      </div>

      {editing && (
        <>
          {/* The shield makes the whole tile a drag handle and keeps its
              links inert while editing. */}
          <button
            type="button"
            className={styles.shield}
            aria-label={t("dashboard.move", {
              name: t(widgetTitleKey(widget.type)),
            })}
            {...attributes}
            {...listeners}
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("dashboard.remove")}
            className={styles.remove}
          >
            <IconMinus size={14} />
          </button>
          {definition.sizes.length > 1 && (
            <div className={styles.sizes} role="group">
              {(["s", "m", "l"] as const)
                .filter((size) => definition.sizes.includes(size))
                .map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-label={t(`dashboard.size.${size}`)}
                    aria-pressed={widget.size === size}
                    onClick={() => onResize(size)}
                    className={cn(
                      styles.sizeOption,
                      widget.size === size && styles.sizeOptionActive,
                    )}
                  >
                    <SizeGlyph size={size} />
                  </button>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SizeGlyph({ size }: { size: WidgetSize }) {
  const rect =
    size === "s"
      ? { width: 7, height: 7 }
      : size === "m"
        ? { width: 14, height: 7 }
        : { width: 14, height: 12 };
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
      <rect
        x={(16 - rect.width) / 2}
        y={(14 - rect.height) / 2}
        width={rect.width}
        height={rect.height}
        rx="2"
        fill="currentColor"
      />
    </svg>
  );
}

/** Press-and-hold without moving → callback; swallows the click that
 *  follows so a held link doesn't navigate. Charts keep their own gestures. */
function useLongPress(onLongPress: () => void, enabled: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }

  if (!enabled) return {};
  return {
    onPointerDown(event: React.PointerEvent) {
      fired.current = false;
      if ((event.target as HTMLElement).closest("[data-gesture]")) return;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(12);
        onLongPress();
        clear();
      }, LONG_PRESS_MS);
    },
    onPointerMove(event: React.PointerEvent) {
      if (!start.current) return;
      if (
        Math.abs(event.clientX - start.current.x) > 8 ||
        Math.abs(event.clientY - start.current.y) > 8
      ) {
        clear();
      }
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onClickCapture(event: React.MouseEvent) {
      if (fired.current) {
        event.preventDefault();
        event.stopPropagation();
        fired.current = false;
      }
    },
    onContextMenu(event: React.MouseEvent) {
      if (timer.current || fired.current) event.preventDefault();
    },
  };
}
