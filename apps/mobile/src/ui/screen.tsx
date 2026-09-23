import type { ReactNode, Ref } from "react";
import {
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

export interface ScreenProps
  extends Omit<ScrollViewProps, "children" | "style" | "contentContainerStyle"> {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Reserve space for the floating tab bar when this screen uses tabs. */
  bottomPadding?: number;
  /** Optional handle for programmatic scrolling during drag gestures. */
  scrollRef?: Ref<ScrollView>;
}

export function Screen({
  children,
  scroll = true,
  edges = ["top"],
  style,
  contentStyle,
  bottomPadding = 0,
  scrollRef,
  ...scrollProps
}: ScreenProps) {
  const content: StyleProp<ViewStyle> = [
    { paddingHorizontal: spacing.lg, paddingBottom: bottomPadding },
    contentStyle,
  ];

  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={content}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
