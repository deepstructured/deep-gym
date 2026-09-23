import {
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
} from "@expo-google-fonts/urbanist";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "../src/theme";
import { useAuth, AuthProvider } from "../src/providers/auth-provider";
import { LocaleProvider } from "../src/providers/locale-provider";
import { QueryProvider } from "../src/providers/query-provider";
import { SessionLoading } from "../src/providers/session-loading";

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <SessionLoading />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Urbanist_400Regular,
    Urbanist_500Medium,
    Urbanist_600SemiBold,
    Urbanist_700Bold,
    Matricha: require("../src/theme/fonts/matricha.ttf"),
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <AuthProvider>
          <LocaleProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </LocaleProvider>
        </AuthProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
