import { View } from "react-native";
import { BottomSheet, Button, Text } from "../ui";
import { useI18n } from "../providers/locale-provider";

interface WorkoutConfirmSheetProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

/** Mirrors the PWA's compact confirmation sheet for destructive form actions. */
export function WorkoutConfirmSheet({ open, title, message, confirmLabel, onClose, onConfirm, loading }: WorkoutConfirmSheetProps) {
  const { t } = useI18n();
  return (
    <BottomSheet open={open} onClose={onClose} title={title} closeLabel={t("common.close")}>
      <Text tone="muted" style={{ marginBottom: 20 }}>{message}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button variant="surface" style={{ flex: 1 }} onPress={onClose}>{t("common.cancel")}</Button>
        <Button variant="danger" style={{ flex: 1 }} disabled={loading} loading={loading} onPress={onConfirm}>{confirmLabel}</Button>
      </View>
    </BottomSheet>
  );
}
