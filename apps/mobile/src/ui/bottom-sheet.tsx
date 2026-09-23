import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "../theme";
import { Text } from "./text";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Runs after the native modal has stopped intercepting touches. */
  onClosed?: () => void;
  title?: string;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Native modal with the same mobile grip, dark surface and safe-area spacing. */
export function BottomSheet({
  open,
  onClose,
  onClosed,
  title,
  closeLabel,
  children,
  footer,
  contentStyle,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [rendered, setRendered] = useState(open);
  const progress = useRef(new Animated.Value(0)).current;
  const hasShown = useRef(false);
  const wasPresented = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (Platform.OS === "ios" || rendered || open || !wasPresented.current) return;
    wasPresented.current = false;
    onClosed?.();
  }, [onClosed, open, rendered]);

  const animateTo = useCallback(
    (toValue: number, duration: number, onFinished?: () => void) => {
      Animated.timing(progress, {
        toValue,
        duration,
        easing: toValue === 1 ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onFinished?.();
      });
    },
    [progress],
  );

  useEffect(() => {
    if (open) {
      setRendered(true);
      // When reopening during the closing animation, the native modal is already shown.
      if (hasShown.current) animateTo(1, 300);
    } else if (rendered) {
      animateTo(0, 220, () => {
        if (!openRef.current) {
          hasShown.current = false;
          setRendered(false);
        }
      });
    }
  }, [animateTo, open, rendered]);

  return (
    <Modal
      visible={rendered}
      transparent
      statusBarTranslucent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
      onShow={() => {
        hasShown.current = true;
        wasPresented.current = true;
        if (openRef.current) animateTo(1, 300);
      }}
      onDismiss={() => {
        if (openRef.current || !wasPresented.current) return;
        wasPresented.current = false;
        onClosed?.();
      }}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            opacity: progress,
          }}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)" }}
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
          pointerEvents="box-none"
        >
          <Animated.View
            accessibilityViewIsModal
            style={{
              maxHeight: "88%",
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
              borderTopWidth: 1,
              borderColor: "rgba(42,42,49,0.6)",
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              paddingHorizontal: spacing.lg,
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [windowHeight, 0],
                  }),
                },
              ],
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: radii.pill,
                backgroundColor: colors.line,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />
            {title ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <Text variant="title" style={{ flex: 1 }}>{title}</Text>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                  hitSlop={8}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radii.pill,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.raised,
                    marginLeft: 12,
                  }}
                >
                  <Ionicons name="close" size={24} color={colors.muted} />
                </Pressable>
              </View>
            ) : null}
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ flexShrink: 1 }}
              contentContainerStyle={contentStyle}
            >
              {children}
            </ScrollView>
            {footer ? <View style={{ paddingTop: spacing.md }}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
