import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  createSessionFromUrl,
  OAUTH_REDIRECT_URL,
} from "../../src/lib/native-auth";
import { useAuth } from "../../src/providers/auth-provider";
import { useI18n } from "../../src/providers/locale-provider";
import { SessionLoading } from "../../src/providers/session-loading";
import { userErrorMessage } from "../../src/lib/user-error";
import { colors } from "../../src/theme";

export default function AuthCallbackScreen() {
  const { code, error: authError, error_description } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      router.replace("/");
      return;
    }
    if (error_description || authError) {
      setError(userErrorMessage(t, error_description || authError, "login.signInFailed"));
      return;
    }
    if (!code) {
      setError(t("login.callbackMissingCode"));
      return;
    }

    let active = true;
    void createSessionFromUrl(
      `${OAUTH_REDIRECT_URL}?code=${encodeURIComponent(code)}`,
    )
      .then(() => {
        if (active) router.replace("/");
      })
      .catch((cause) => {
        if (active)
          setError(userErrorMessage(t, cause, "login.signInFailed"));
      });
    return () => {
      active = false;
    };
  }, [code, authError, error_description, router, t, user]);

  if (!error) return <SessionLoading />;

  return (
    <View style={styles.root}>
      <Text style={styles.error}>{error}</Text>
      <Pressable onPress={() => router.replace("/login")}>
        <Text style={styles.link}>{t("login.backToSignIn")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  error: { color: "#FFA8A8", fontFamily: "Urbanist_500Medium" },
  link: {
    color: colors.lime,
    fontFamily: "Urbanist_600SemiBold",
    marginTop: 20,
  },
});
