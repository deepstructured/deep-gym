import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
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
  signInWithGoogle,
  verifyTelegramCode,
} from "../src/lib/native-auth";
import { isSupabaseConfigured } from "../src/lib/supabase";
import { userErrorMessage } from "../src/lib/user-error";
import { useI18n } from "../src/providers/locale-provider";
import { colors } from "../src/theme";
import { BrandMark, GradientCard } from "../src/ui";

type TelegramStep = "username" | "code";
// StoreClient also includes development builds; appOwnership singles out Expo Go.
const isExpoGo = Constants.appOwnership === "expo";

function GoogleMark() {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 01-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.8z" fill="#4285F4" />
    <Path d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3a7.24 7.24 0 01-10.8-3.8H1.26v3.1A12 12 0 0012 24z" fill="#34A853" />
    <Path d="M5.27 14.28a7.2 7.2 0 010-4.56v-3.1H1.26a12 12 0 000 10.77l4.01-3.11z" fill="#FBBC05" />
    <Path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.98 11.98 0 001.26 6.62l4 3.1A7.17 7.17 0 0112 4.75z" fill="#EA4335" />
  </Svg>;
}

export default function LoginScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [step, setStep] = useState<TelegramStep>("username");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"google" | "telegram" | null>(null);
  const busy = pending !== null;
  const [error, setError] = useState<string | null>(null);
  const botUsername = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(
    /^@/,
    "",
  );

  async function run(action: () => Promise<void>, fallback: "login.googleFailed" | "login.signInFailed" = "login.signInFailed", provider: "google" | "telegram" = "telegram") {
    setPending(provider);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(userErrorMessage(t, cause, fallback));
    } finally {
      setPending(null);
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

          <View style={styles.providerGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || isExpoGo || !isSupabaseConfigured }}
              disabled={busy || isExpoGo || !isSupabaseConfigured}
              onPress={() => void run(signInWithGoogle, "login.googleFailed", "google")}
              style={({ pressed }) => [
                styles.primaryButton,
                styles.googleButton,
                (pressed || busy || isExpoGo || !isSupabaseConfigured) &&
                  styles.buttonDimmed,
              ]}
            >
              {pending === "google" ? <ActivityIndicator color={colors.text} /> : <GoogleMark />}
              <Text style={[styles.primaryButtonText, styles.googleButtonText]}>
                {t("login.continueGoogle")}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: telegramOpen, disabled: busy || !isSupabaseConfigured }}
              disabled={busy || !isSupabaseConfigured}
              onPress={() => { setTelegramOpen((open) => !open); setError(null); }}
              style={({ pressed }) => [styles.primaryButton, (pressed || busy || !isSupabaseConfigured) && styles.buttonDimmed]}
            >
              <Ionicons name="paper-plane-outline" size={20} color={colors.black} />
              <Text style={styles.primaryButtonText}>{t("login.continueTelegram")}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              disabled
              style={styles.applePlaceholder}
            >
              <Ionicons name="logo-apple" size={20} color={colors.text} />
              <Text style={styles.applePlaceholderText}>{t("login.continueApple")}</Text>
              <Text style={styles.comingSoon}>{t("login.comingSoon")}</Text>
            </Pressable>
          </View>

          {isExpoGo ? (
            <Text style={styles.expoGoNote}>{t("login.googleExpoGo")}</Text>
          ) : null}

          {botUsername ? (
            <View style={styles.telegramGuide}>
              <Text style={styles.telegramGuideText}>{t("login.telegramFirstStep")}</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t("login.openTelegramBot", { username: botUsername })}
                onPress={() => void Linking.openURL(`https://t.me/${botUsername}`)}
                style={({ pressed }) => [styles.botLinkButton, pressed && styles.buttonDimmed]}
              >
                <Ionicons name="paper-plane" size={18} color={colors.lime} />
                <Text style={styles.botLinkText}>{t("login.openTelegramBot", { username: botUsername })}</Text>
                <Ionicons name="open-outline" size={16} color={colors.lime} />
              </Pressable>
            </View>
          ) : null}

          {telegramOpen ? (
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
          ) : null}

          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/privacy")}
            style={styles.privacyLink}
          >
            <Text style={styles.privacyLinkText}>{t("settings.privacyPolicy")}</Text>
          </Pressable>

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
  providerGroup: { gap: 10 },
  applePlaceholder: {
    minHeight: 54,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.raised,
    opacity: 0.62,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  applePlaceholderText: {
    color: colors.text,
    fontFamily: "Urbanist_500Medium",
    fontSize: 15,
  },
  comingSoon: {
    color: colors.muted,
    fontFamily: "Urbanist_500Medium",
    fontSize: 11,
  },
  privacyLink: { alignSelf: "center", marginTop: 18, padding: 8 },
  privacyLinkText: {
    color: colors.muted,
    fontFamily: "Urbanist_500Medium",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  telegramForm: { gap: 10, marginTop: 18 },
  telegramGuide: {
    marginTop: 18,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  telegramGuideText: {
    color: colors.text,
    fontFamily: "Urbanist_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  botLinkButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    paddingHorizontal: 14,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(215,246,81,0.45)",
    backgroundColor: "rgba(215,246,81,0.12)",
  },
  botLinkText: {
    color: colors.lime,
    fontFamily: "Urbanist_700Bold",
    fontSize: 15,
  },
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
  googleButton: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 28,
  },
  primaryButtonText: {
    color: "#14120C",
    fontFamily: "Urbanist_700Bold",
    fontSize: 16,
  },
  googleButtonText: {
    color: colors.text,
    fontFamily: "Urbanist_500Medium",
    fontSize: 15,
  },
  buttonDimmed: { opacity: 0.68 },
  botNote: {
    color: colors.faint,
    fontFamily: "Urbanist_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
  expoGoNote: {
    color: colors.muted,
    backgroundColor: colors.surface,
    borderRadius: 13,
    fontFamily: "Urbanist_500Medium",
    fontSize: 14,
    lineHeight: 20,
    padding: 16,
    textAlign: "center",
    marginTop: 14,
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
