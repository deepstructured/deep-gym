import {
  getPrivacyPolicy,
  PRIVACY_POLICY_CONTACT,
  PRIVACY_POLICY_DEVELOPER_CONTACT,
} from "@deepgym/core/privacy-policy";
import { router } from "expo-router";
import { Linking, Pressable, View } from "react-native";

import { useAuth } from "../src/providers/auth-provider";
import { useI18n } from "../src/providers/locale-provider";
import { colors } from "../src/theme";
import { BrandMark, Screen, Text } from "../src/ui";

export default function PrivacyPage() {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const policy = getPrivacyPolicy(lang);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(user ? "/" : "/login");
  };

  return (
    <Screen bottomPadding={48} contentStyle={{ paddingTop: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.raised,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 26, lineHeight: 28 }}>‹</Text>
        </Pressable>
        <BrandMark size={28} />
        <Text weight="bold" style={{ fontSize: 18 }}>DeepGym</Text>
      </View>

      <Text variant="micro" tone="lime">DeepGym</Text>
      <Text variant="display" style={{ marginTop: 8 }}>{policy.title}</Text>
      <Text tone="muted" style={{ marginTop: 8, marginBottom: 20 }}>{policy.effectiveDateLabel}</Text>
      <Text style={{ fontSize: 16, lineHeight: 25 }}>{policy.overview}</Text>

      {policy.sections.map((section) => (
        <View
          key={section.id}
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.line,
            marginTop: 28,
            paddingTop: 24,
            gap: 12,
          }}
        >
          <Text variant="title">{section.title}</Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} tone="muted" style={{ lineHeight: 24 }}>{paragraph}</Text>
          ))}
          {section.bullets?.map((bullet) => (
            <View key={bullet} style={{ flexDirection: "row", gap: 10, paddingLeft: 2 }}>
              <Text tone="lime" style={{ lineHeight: 24 }}>•</Text>
              <Text tone="muted" style={{ flex: 1, lineHeight: 24 }}>{bullet}</Text>
            </View>
          ))}
        </View>
      ))}
      <Pressable
        onPress={() => void Linking.openURL(`mailto:${PRIVACY_POLICY_CONTACT}`).catch(() => {})}
        accessibilityRole="link"
        style={{
          alignSelf: "flex-start",
          marginTop: 28,
          paddingHorizontal: 20,
          paddingVertical: 13,
          borderRadius: 24,
          backgroundColor: colors.lime,
        }}
      >
        <Text weight="semibold" style={{ color: colors.background }}>{policy.contactAction} ↗</Text>
      </Pressable>
      <Text tone="faint" style={{ marginTop: 28, textAlign: "center" }}>
        {policy.developerCredit} · deepagency.digital
      </Text>
      <Pressable
        onPress={() => void Linking.openURL(`mailto:${PRIVACY_POLICY_DEVELOPER_CONTACT}`).catch(() => {})}
        accessibilityRole="link"
        style={{ marginTop: 8, alignItems: "center" }}
      >
        <Text tone="faint">{policy.developerContactLabel}: {PRIVACY_POLICY_DEVELOPER_CONTACT}</Text>
      </Pressable>
    </Screen>
  );
}
