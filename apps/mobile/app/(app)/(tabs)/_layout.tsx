import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "../../../src/providers/locale-provider";
import { colors } from "../../../src/theme";

export default function TabLayout() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lime,
        tabBarInactiveTintColor: colors.faint,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 68 + insets.bottom,
          paddingTop: 9,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: "rgba(10,10,12,0.85)",
          borderTopColor: colors.line,
          borderTopWidth: 1,
        },
        tabBarBackground: () => (
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        tabBarLabelStyle: {
          fontFamily: "Urbanist_500Medium",
          fontSize: 10,
          marginTop: 2,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.home"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("nav.history"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: t("nav.add"),
          tabBarLabel: () => null,
          tabBarButton: ({ onPress, accessibilityState }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("nav.add")}
              accessibilityState={accessibilityState}
              onPress={onPress}
              style={styles.addSlot}
            >
              <View style={styles.addButton}>
                <Text style={styles.addGlyph}>+</Text>
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t("nav.progress"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t("nav.library"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: 54,
    height: 54,
    transform: [{ translateY: -10 }],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.38,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  addGlyph: {
    color: "#12140B",
    fontFamily: "Urbanist_500Medium",
    fontSize: 34,
    lineHeight: 39,
  },
});
