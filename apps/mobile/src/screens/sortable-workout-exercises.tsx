import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Animated, PanResponder, ScrollView, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { DraftExercise } from "../data/draft";
import { colors, fonts } from "../theme";
import { Text } from "../ui";
import { useI18n } from "../providers/locale-provider";

type Drag = { key: string; from: number; over: number };
type Layout = { y: number; height: number };

interface SortableWorkoutExercisesProps {
  items: DraftExercise[];
  renderCard: (exercise: DraftExercise, index: number, handle: ReactNode) => ReactNode;
  onReorder: (from: number, to: number) => void;
  onDragChange?: (dragging: boolean) => void;
  scrollRef?: RefObject<ScrollView | null>;
  scrollOffsetRef?: RefObject<number>;
}

/** Reorder by holding the small grip, leaving set inputs free to scroll and edit. */
export function SortableWorkoutExercises({ items, renderCard, onReorder, onDragChange, scrollRef, scrollOffsetRef }: SortableWorkoutExercisesProps) {
  const { t } = useI18n();
  const { height: windowHeight } = useWindowDimensions();
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const itemRef = useRef(items);
  const layoutRef = useRef(new Map<string, Layout>());
  const reorderRef = useRef(onReorder);
  const onDragChangeRef = useRef(onDragChange);
  const offset = useRef(new Animated.Value(0)).current;
  const scrollAtStart = useRef(0);
  const fingerY = useRef<number | null>(null);
  const rawDy = useRef(0);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const moveRef = useRef<(dy: number) => void>(() => undefined);
  itemRef.current = items;
  reorderRef.current = onReorder;
  onDragChangeRef.current = onDragChange;

  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    autoScrollTimer.current = null;
    fingerY.current = null;
  }, []);

  const start = useCallback((key: string, pageY: number) => {
    const from = itemRef.current.findIndex((entry) => entry.key === key);
    if (from < 0 || itemRef.current.length < 2) return;
    stopAutoScroll();
    scrollAtStart.current = scrollOffsetRef?.current ?? 0;
    fingerY.current = pageY;
    rawDy.current = 0;
    offset.setValue(0);
    const next = { key, from, over: from };
    dragRef.current = next;
    setDrag(next);
    onDragChangeRef.current?.(true);
    if (scrollRef && scrollOffsetRef) {
      autoScrollTimer.current = setInterval(() => {
        if (!dragRef.current || fingerY.current == null) return;
        const topEdge = 115;
        const bottomEdge = windowHeight - 145;
        const speed = fingerY.current < topEdge
          ? -Math.min(22, Math.max(5, (topEdge - fingerY.current) * 0.2))
          : fingerY.current > bottomEdge
            ? Math.min(22, Math.max(5, (fingerY.current - bottomEdge) * 0.2))
            : 0;
        if (speed === 0) return;
        scrollRef.current?.scrollTo({ y: Math.max(0, scrollOffsetRef.current + speed), animated: false });
        // The parent scroll offset updates in onScroll; include that distance
        // in the card translation so it remains under the finger.
        requestAnimationFrame(() => moveRef.current(rawDy.current));
      }, 32);
    }
  }, [offset, scrollRef, scrollOffsetRef, stopAutoScroll, windowHeight]);

  const overAt = useCallback((active: Drag, dy: number) => {
    const source = layoutRef.current.get(active.key);
    if (!source) return active.from;
    const center = source.y + source.height / 2 + dy;
    let over = active.from;
    let distance = Number.POSITIVE_INFINITY;
    itemRef.current.forEach((entry, index) => {
      const box = layoutRef.current.get(entry.key);
      if (!box) return;
      const nextDistance = Math.abs(center - box.y - box.height / 2);
      if (nextDistance < distance) {
        over = index;
        distance = nextDistance;
      }
    });
    return over;
  }, []);

  const move = useCallback((gestureDy: number) => {
    const active = dragRef.current;
    if (!active) return;
    const dy = gestureDy + (scrollOffsetRef?.current ?? 0) - scrollAtStart.current;
    offset.setValue(dy);
    const over = overAt(active, dy);
    if (over !== active.over) {
      const next = { ...active, over };
      dragRef.current = next;
      setDrag(next);
    }
  }, [offset, overAt, scrollOffsetRef]);
  moveRef.current = move;

  const end = useCallback((gestureDy: number) => {
    const active = dragRef.current;
    if (!active) return;
    const dy = gestureDy + (scrollOffsetRef?.current ?? 0) - scrollAtStart.current;
    const over = overAt(active, dy);
    stopAutoScroll();
    dragRef.current = null;
    offset.setValue(0);
    setDrag(null);
    onDragChangeRef.current?.(false);
    if (over !== active.from) reorderRef.current(active.from, over);
  }, [offset, overAt, scrollOffsetRef, stopAutoScroll]);

  const cancel = useCallback(() => {
    if (!dragRef.current) return;
    stopAutoScroll();
    dragRef.current = null;
    offset.setValue(0);
    setDrag(null);
    onDragChangeRef.current?.(false);
  }, [offset, stopAutoScroll]);

  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  // When an exercise is removed while dragging, do not commit a stale index.
  useEffect(() => {
    if (dragRef.current && !items.some((entry) => entry.key === dragRef.current?.key)) cancel();
  }, [items, cancel]);

  const activeHeight = drag ? layoutRef.current.get(drag.key)?.height ?? 0 : 0;
  return (
    <View style={{ gap: 13 }}>
      {items.map((entry, index) => {
        let displaced = 0;
        if (drag && index !== drag.from) {
          if (drag.from < drag.over && index > drag.from && index <= drag.over) displaced = -(activeHeight + 13);
          if (drag.from > drag.over && index >= drag.over && index < drag.from) displaced = activeHeight + 13;
        }
        const isActive = drag?.key === entry.key;
        const handle = (
          <WorkoutDragHandle
            key={entry.key}
            index={index + 1}
            enabled={items.length > 1}
            label={t("exercise.reorder", { name: entry.name })}
            moveUpLabel={t("templates.moveUp", { name: entry.name })}
            moveDownLabel={t("templates.moveDown", { name: entry.name })}
            onStart={(pageY) => start(entry.key, pageY)}
            onMove={(dy, pageY) => {
              fingerY.current = pageY;
              rawDy.current = dy;
              move(dy);
            }}
            onEnd={end}
            onCancel={cancel}
            onStep={(step) => {
              const next = index + step;
              if (next >= 0 && next < itemRef.current.length) reorderRef.current(index, next);
            }}
          />
        );
        return (
          <Animated.View
            key={entry.key}
            onLayout={(event: LayoutChangeEvent) => {
              layoutRef.current.set(entry.key, event.nativeEvent.layout);
            }}
            style={{
              zIndex: isActive ? 10 : 0,
              elevation: isActive ? 10 : 0,
              opacity: isActive ? 0.96 : 1,
              transform: [{ translateY: isActive ? offset : displaced }],
            }}
          >
            {renderCard(entry, index, handle)}
          </Animated.View>
        );
      })}
    </View>
  );
}

interface WorkoutDragHandleProps {
  index: number;
  enabled: boolean;
  label: string;
  moveUpLabel: string;
  moveDownLabel: string;
  onStart: (pageY: number) => void;
  onMove: (dy: number, pageY: number) => void;
  onEnd: (dy: number) => void;
  onCancel: () => void;
  onStep: (step: -1 | 1) => void;
}

function WorkoutDragHandle({ index, enabled, label, moveUpLabel, moveDownLabel, onStart, onMove, onEnd, onCancel, onStep }: WorkoutDragHandleProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);
  const callbacks = useRef({ onStart, onMove, onEnd, onCancel });
  callbacks.current = { onStart, onMove, onEnd, onCancel };
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => clearTimer(), []);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => enabled,
    onMoveShouldSetPanResponder: () => enabled,
    onPanResponderGrant: (event) => {
      active.current = false;
      clearTimer();
      const pageY = event.nativeEvent.pageY;
      timer.current = setTimeout(() => {
        active.current = true;
        callbacks.current.onStart(pageY);
      }, 260);
    },
    onPanResponderMove: (_event, gesture) => {
      if (active.current) callbacks.current.onMove(gesture.dy, gesture.moveY);
      else if (Math.abs(gesture.dy) > 10 || Math.abs(gesture.dx) > 10) clearTimer();
    },
    onPanResponderRelease: (_event, gesture) => {
      clearTimer();
      if (active.current) callbacks.current.onEnd(gesture.dy);
      active.current = false;
    },
    onPanResponderTerminate: () => {
      clearTimer();
      if (active.current) callbacks.current.onCancel();
      active.current = false;
    },
    onPanResponderTerminationRequest: () => !active.current,
  }), [enabled]);

  return (
    <View
      {...pan.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityActions={[{ name: "decrement", label: moveUpLabel }, { name: "increment", label: moveDownLabel }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "decrement") onStep(-1);
        if (event.nativeEvent.actionName === "increment") onStep(1);
      }}
      style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 3, opacity: enabled ? 1 : 0.55 }}
    >
      <Svg width={12} height={18} viewBox="0 0 12 18" fill={colors.faint}>
        {[3, 9, 15].flatMap((y) => [
          <Circle key={`left-${y}`} cx={3} cy={y} r={1.25} />,
          <Circle key={`right-${y}`} cx={9} cy={y} r={1.25} />,
        ])}
      </Svg>
      <Text style={{ fontFamily: fonts.dot, fontSize: 13, lineHeight: 18, color: colors.faint }}>{String(index).padStart(2, "0")}</Text>
    </View>
  );
}
