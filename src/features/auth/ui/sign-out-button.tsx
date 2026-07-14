"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/shared/i18n";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { Button, IconLogout } from "@/shared/ui";

export function SignOutButton() {
  const router = useRouter();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await getSupabaseBrowser().auth.signOut();
    queryClient.clear();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      variant="danger"
      size="lg"
      className="w-full"
      onClick={signOut}
      loading={loading}
    >
      {!loading && <IconLogout size={19} />}
      {t("settings.signOut")}
    </Button>
  );
}
