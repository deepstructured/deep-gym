import { useEffect, useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  requestTelegramCode,
  signInWithApple,
  signInWithGoogle,
  verifyTelegramCode,
} from "../src/lib/native-auth";
import { isSupabaseConfigured } from "../src/lib/supabase";
import { userErrorMessage } from "../src/lib/user-error";
import { useI18n } from "../src/providers/locale-provider";
import { colors } from "../src/theme";
import { BrandMark, GradientCard } from "../src/ui";

type Method = "google" | "telegram";
type TelegramStep = "username" | "code";

export default function LoginScreen() {
  const { t } = useI18n();
  const [method, setMethod] = useState<Method>("google");
  const [step, setStep] = useState<TelegramStep>("username");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const botUsername = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(
    /^@/,
    "",
  );

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    void AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (active) setAppleAvailable(available);
      })
      .catch(() => {
        if (active) setAppleAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function run(action: () => Promise<void>, fallback: "login.googleFailed" | "login.signInFailed" = "login.signInFailed") {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(userErrorMessage(t, cause, fallback));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    await run(async () => {
      await requestTelegramCode(username.trim());
      setStep("code");
    });
  }

  async function verifyCode() {
    await run(() => verifyTelegramCode(username.trim(), code));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <GradientCard
            variant="indigo"
            padding={32}
            style={styles.brandCard}
            contentStyle={styles.brandContent}
          >
            <BrandMark size={112} />
            <Text style={styles.brandName}>DeepGym</Text>
            <Text style={styles.brandTagline}>{t("login.tagline")}</Text>
          </GradientCard>

          <Text style={styles.heading}>{t("login.welcome")}</Text>
          <Text style={styles.subtitle}>{t("login.signInToStart")}</Text>

          {!isSupabaseConfigured && (
            <Text style={styles.error}>
              {t("login.configUnavailable")}
            </Text>
          )}

          {appleAvailable && isSupabaseConfigured ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={15}
              onPress={() => {
                if (!busy) void run(signInWithApple);
              }}
              style={styles.appleButton}
            />
          ) : null}

          <View style={styles.segmented}>
            {(["google", "telegram"] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: method === option }}
                disabled={busy}
                onPress={() => {
                  setMethod(option);
                  setError(null);
                }}
                style={[
                  styles.segment,
                  method === option && styles.segmentActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    method === option && styles.segmentTextActive,
                  ]}
                >
                  {option === "google" ? "Google" : "Telegram"}
                </Text>
              </Pressable>
            ))}
          </View>

          {method === "google" ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy || !isSupabaseConfigured}
              onPress={() => run(signInWithGoogle, "login.googleFailed")}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || busy || !isSupabaseConfigured) &&
                  styles.buttonDimmed,
              ]}
            >
              {busy ? <ActivityIndicator color="#14120C" /> : null}
              <Text style={styles.primaryButtonText}>
                {t("login.continueGoogle")}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.telegramForm}>
              {step === "username" ? (
                <>
                  <Text style={styles.label}>{t("login.telegramUsername")}</Text>
                  <TextInput
                    accessibilityLabel={t("login.telegramUsername")}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="@username"
                    placeholderTextColor="#827B92"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="username"
                    style={styles.input}
                    returnKeyType="go"
                    onSubmitEditing={() => {
                      if (username.trim()) void sendCode();
                    }}
                  />
                  {botUsername ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() =>
                        void Linking.openURL(`https://t.me/${botUsername}`)
                      }
                    >
                      <Text style={styles.botLink}>
                        {t("login.firstTime")} @{botUsername}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || !username.trim() || !isSupabaseConfigured}
                    onPress={() => void sendCode()}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      (pressed || busy || !username.trim()) &&
                        styles.buttonDimmed,
                    ]}
                  >
                    {busy ? <ActivityIndicator color="#14120C" /> : null}
                    <Text style={styles.primaryButtonText}>
                      {t("login.sendCode")}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.label}>
                    {t("login.codeSent", {
                      username: username.replace(/^@/, ""),
                    })}
                  </Text>
                  <TextInput
                    accessibilityLabel={t("login.codeSent", {
                      username: username.replace(/^@/, ""),
                    })}
                    value={code}
                    onChangeText={(value) =>
                      setCode(value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="••••••"
                    placeholderTextColor="#827B92"
                    keyboardType="number-pad"
                    autoFocus
                    maxLength={6}
                    style={[styles.input, styles.codeInput]}
                    onSubmitEditing={() => {
                      if (code.length === 6) void verifyCode();
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || code.length !== 6}
                    onPress={() => void verifyCode()}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      (pressed || busy || code.length !== 6) &&
                        styles.buttonDimmed,
                    ]}
                  >
                    {busy ? <ActivityIndicator color="#14120C" /> : null}
                    <Text style={styles.primaryButtonText}>
                      {t("login.signIn")}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setStep("username");
                      setCode("");
                      setError(null);
                    }}
                  >
                    <Text style={styles.switchUser}>
                      {t("login.differentUsername")}
                    </Text>
                  </Pressable>
                </>
              )}
              <Text style={styles.botNote}>{t("login.botNote")}</Text>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 38,
    justifyContent: "center",
  },
  brandCard: {
    width: "100%",
    maxWidth: 288,
    minHeight: 238,
    alignSelf: "center",
    marginBottom: 24,
  },
  brandContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    color: colors.white,
    fontFamily: "Urbanist_600SemiBold",
    fontSize: 16,
    letterSpacing: 2.56,
    textTransform: "uppercase",
    marginTop: 20,
  },
  brandTagline: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Urbanist_400Regular",
    fontSize: 13,
    marginTop: 6,
  },
  heading: {
    color: colors.text,
    fontFamily: "Urbanist_600SemiBold",
    fontSize: 24,
    textAlign: "center",
  },
  subtitle: {
    color: colors.muted,
    fontFamily: "Urbanist_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 26,
  },
  appleButton: {
    width: "100%",
    height: 54,
    marginBottom: 18,
  },
  segmented: {
    flexDirection: "row",
    borderRadius: 15,
    padding: 4,
    backgroundColor: colors.surface,
    marginBottom: 18,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  segmentActive: { backgroundColor: colors.raised },
  segmentText: {
    color: colors.muted,
    fontFamily: "Urbanist_600SemiBold",
    fontSize: 14,
  },
  segmentTextActive: { color: colors.text },
  telegramForm: { gap: 10 },
  label: {
    color: colors.text,
    fontFamily: "Urbanist_600SemiBold",
    fontSize: 14,
  },
  input: {
    height: 52,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.raised,
    color: colors.text,
    fontFamily: "Urbanist_500Medium",
    fontSize: 16,
    paddingHorizontal: 15,
  },
  codeInput: {
    fontFamily: "Matricha",
    fontSize: 25,
    letterSpacing: 8,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: "#14120C",
    fontFamily: "Urbanist_700Bold",
    fontSize: 16,
  },
  buttonDimmed: { opacity: 0.68 },
  botLink: {
    color: colors.lime,
    fontFamily: "Urbanist_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  botNote: {
    color: colors.faint,
    fontFamily: "Urbanist_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
  switchUser: {
    color: colors.lime,
    fontFamily: "Urbanist_500Medium",
    fontSize: 14,
    textAlign: "center",
    padding: 10,
  },
  error: {
    color: "#FFA8A8",
    fontFamily: "Urbanist_500Medium",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 10,
  },
});
