import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "../theme";
import { Text } from "./text";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
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
  title,
  closeLabel,
  children,
  footer,
  contentStyle,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      transparent
      statusBarTranslucent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
          }}
        />
        <View
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
                <Text tone="muted" style={{ fontSize: 27, lineHeight: 31 }}>×</Text>
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
