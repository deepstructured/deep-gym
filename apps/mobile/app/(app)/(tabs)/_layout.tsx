import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { draftIsEmpty, useWorkoutDraft } from "../../../src/data/draft";
import { useI18n } from "../../../src/providers/locale-provider";
import { colors } from "../../../src/theme";
import { TabIcon, type TabIconName } from "../../../src/ui/tab-icon";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const HAS_LIQUID_GLASS =
  Platform.OS === "ios" && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

const ICONS: Record<string, TabIconName> = {
  index: "home",
  history: "history",
  new: "new",
  progress: "progress",
  library: "library",
};

function TabBarButton({
  focused,
  label,
  icon,
  isAdd,
  hasDraft,
  testID,
  onPress,
  onPressIn,
  onPressOut,
  onLongPress,
}: {
  focused: boolean;
  label: string;
  icon: TabIconName;
  isAdd: boolean;
  hasDraft: boolean;
  testID?: string;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={onLongPress}
      hitSlop={{ top: 10, bottom: 10 }}
      style={styles.slot}
    >
      <View style={styles.iconSurface}>
        {isAdd ? (
          <>
            <View style={styles.addSurface}>
              <TabIcon name="new" size={31} color={colors.background} />
            </View>
            {hasDraft ? <View style={styles.liveDot} /> : null}
          </>
        ) : (
          <TabIcon name={icon} size={24} color={focused ? colors.lime : colors.muted} />
        )}
      </View>
    </Pressable>
  );
}

function FloatingTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [itemsWidth, setItemsWidth] = useState(0);
  const selectedIndex = useRef(new Animated.Value(state.index)).current;
  const glassStretch = useRef(new Animated.Value(1)).current;
  const panelScale = useRef(new Animated.Value(1)).current;
  const previousIndex = useRef(state.index);
  const addTabIndex = state.routes.findIndex((route) => route.name === "new");
  const indicatorJumps =
    previousIndex.current === addTabIndex ||
    state.index === addTabIndex ||
    (previousIndex.current - addTabIndex) * (state.index - addTabIndex) < 0;
  const hasDraft = useWorkoutDraft((value) =>
    value.ownerId != null && !draftIsEmpty(value.draft),
  );

  useEffect(() => {
    if (previousIndex.current === state.index) return;
    const fromIndex = previousIndex.current;
    previousIndex.current = state.index;

    // The add button covers the centre slot. Keep the selection surface out of
    // that slot so its glass rim cannot peek out around the lime circle.
    if (
      fromIndex === addTabIndex ||
      state.index === addTabIndex ||
      (fromIndex - addTabIndex) * (state.index - addTabIndex) < 0
    ) {
      selectedIndex.stopAnimation();
      selectedIndex.setValue(state.index);
      glassStretch.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.spring(selectedIndex, {
        toValue: state.index,
        stiffness: 290,
        damping: 27,
        mass: 0.95,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(glassStretch, {
          toValue: 1.06,
          duration: 125,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(glassStretch, {
          toValue: 1,
          stiffness: 220,
          damping: 20,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [addTabIndex, glassStretch, selectedIndex, state.index]);

  const animatePanel = (pressed: boolean) => {
    panelScale.stopAnimation();
    Animated.spring(panelScale, {
      toValue: pressed ? 1.025 : 1,
      stiffness: pressed ? 420 : 270,
      damping: pressed ? 24 : 15,
      mass: 0.72,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          bottom: Math.max(insets.bottom + 8, 18),
          paddingHorizontal: Math.max(insets.left, insets.right, 18),
        },
      ]}
    >
      <Animated.View
        style={[
          styles.pill,
          HAS_LIQUID_GLASS && styles.liquidPill,
          { transform: [{ scale: panelScale }] },
        ]}
      >
        <View pointerEvents="none" style={styles.backdrop}>
          {HAS_LIQUID_GLASS ? (
            <GlassView
              colorScheme="dark"
              glassEffectStyle="regular"
              tintColor="rgba(24,24,28,0.54)"
              style={styles.glassFill}
            />
          ) : (
            <>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.tint} />
            </>
          )}
        </View>
        <View
          style={styles.items}
          onLayout={(event) => setItemsWidth(event.nativeEvent.layout.width)}
        >
          {itemsWidth > 0 && state.routes[state.index]?.name !== "new" ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeIndicator,
                {
                  left: 6,
                  width: (itemsWidth - 12) / state.routes.length,
                  transform: [
                    {
                      translateX: indicatorJumps
                        ? (state.index * (itemsWidth - 12)) / state.routes.length
                        : Animated.multiply(
                            selectedIndex,
                            (itemsWidth - 12) / state.routes.length,
                          ),
                    },
                    { scaleX: glassStretch },
                  ],
                },
              ]}
            >
              {HAS_LIQUID_GLASS ? (
                <GlassView
                  colorScheme="dark"
                  glassEffectStyle="regular"
                  tintColor="rgba(175,175,185,0.22)"
                  style={styles.glassFill}
                />
              ) : (
                <View style={styles.fallbackIndicator} />
              )}
            </Animated.View>
          ) : null}
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const options = descriptors[route.key].options;
            const icon = ICONS[route.name] ?? ICONS.index;
            const isAdd = route.name === "new";
            const label = options.tabBarAccessibilityLabel ?? options.title ?? route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <TabBarButton
                key={route.key}
                label={label}
                focused={focused}
                icon={icon}
                isAdd={isAdd}
                hasDraft={hasDraft}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onPressIn={() => animatePanel(true)}
                onPressOut={() => animatePanel(false)}
                onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              />
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useI18n();

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        lazy: false,
        freezeOnBlur: false,
        animation: "none",
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("nav.home") }} />
      <Tabs.Screen name="history" options={{ title: t("nav.history") }} />
      <Tabs.Screen name="new" options={{ title: t("nav.add") }} />
      <Tabs.Screen name="progress" options={{ title: t("nav.progress") }} />
      <Tabs.Screen name="library" options={{ title: t("nav.library") }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
  pill: {
    width: "100%",
    maxWidth: 356,
    height: 64,
    borderRadius: 36,
    backgroundColor: "rgba(18,18,22,0.92)",
    shadowColor: "#000000",
    shadowOpacity: 0.48,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 16,
  },
  liquidPill: {
    backgroundColor: "transparent",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 36,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
  },
  tint: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(17,17,21,0.52)",
  },
  glassFill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 36,
  },
  items: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  slot: {
    flex: 1,
    height: 64,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  iconSurface: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  addSurface: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.27,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  liveDot: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: colors.flame,
  },
  activeIndicator: {
    position: "absolute",
    top: 5,
    height: 54,
    borderRadius: 27,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },
  fallbackIndicator: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.11)",
  },
});
