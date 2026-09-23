import { CURRENT_RELEASE } from "@deepgym/core/releases";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useI18n } from "../providers/locale-provider";
import { colors } from "../theme";
import { BottomSheet } from "./bottom-sheet";
import { BrandMark } from "./brand-mark";
import { Button } from "./button";
import { Card, GradientCard } from "./card";
import { Text } from "./text";

const RELEASE_ITEMS = [
  { title: "whatsNew.home.title", body: "whatsNew.home.body", icon: "grid-outline", color: colors.lime },
  { title: "whatsNew.progress.title", body: "whatsNew.progress.body", icon: "stats-chart-outline", color: colors.indigoBright },
  { title: "whatsNew.workout.title", body: "whatsNew.workout.body", icon: "flame-outline", color: colors.cherryBright },
  { title: "whatsNew.library.title", body: "whatsNew.library.body", icon: "library-outline", color: colors.indigoBright },
] as const;

/** Shared release content for first-run announcements and the Settings entry. */
export function ReleaseNotesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <BottomSheet open={open} onClose={onClose} title={t("whatsNew.title")} closeLabel={t("common.close")}>
      <GradientCard variant="indigo" padding={22}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BrandMark size={31} />
          <Text variant="caption" tone="muted">{t("whatsNew.version", { version: CURRENT_RELEASE.label })}</Text>
        </View>
        <Text variant="title" style={{ marginTop: 28 }}>{t("whatsNew.releaseTitle")}</Text>
        <Text tone="muted" style={{ marginTop: 8 }}>{t("whatsNew.releaseBody")}</Text>
      </GradientCard>
      <View style={{ marginTop: 20, gap: 10 }}>
        {RELEASE_ITEMS.map((item) => (
          <Card key={item.title} radius={20} padding={16}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Ionicons name={item.icon} color={item.color} size={20} />
              <View style={{ flex: 1 }}>
                <Text weight="semibold">{t(item.title)}</Text>
                <Text tone="muted" variant="caption" style={{ marginTop: 4 }}>{t(item.body)}</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
      <Button variant="lime" block size="lg" onPress={onClose} style={{ marginTop: 20 }}>
        {t("whatsNew.gotIt")}
      </Button>
    </BottomSheet>
  );
}
