import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { colors } from "../theme";
import { Button, Text } from "../ui";
import { useAuth } from "./auth-provider";
import { useI18n } from "./locale-provider";

export function SessionLoading() {
  const { resetLocalSession } = useAuth();
  const { t } = useI18n();
  const [slow, setSlow] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  async function reset() {
    setResetting(true);
    setError(false);
    try {
      await resetLocalSession();
    } catch {
      setError(true);
      setResetting(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        padding: 24,
      }}
    >
      <ActivityIndicator color={colors.lime} />
      {__DEV__ && slow ? (
        <View style={{ alignItems: "center", marginTop: 24, gap: 14 }}>
          <Text tone="muted">{t("auth.sessionSlow")}</Text>
          <Button variant="surface" loading={resetting} onPress={() => void reset()}>
            {t("auth.resetLocalSession")}
          </Button>
          {error ? <Text tone="pink">{t("common.error")}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
