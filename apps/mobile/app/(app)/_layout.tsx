import { Stack } from "expo-router";

import { useWorkoutDraftSync } from "../../src/data/draft";
import { ProductExperience } from "../../src/providers/product-experience";
import { colors } from "../../src/theme";

function ReadyApp() {
  useWorkoutDraftSync();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

export default function AuthenticatedLayout() {
  return <ProductExperience><ReadyApp /></ProductExperience>;
}
