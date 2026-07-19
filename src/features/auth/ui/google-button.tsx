"use client";

import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { Button, IconGoogle } from "@/shared/ui";

export function GoogleSignInButton() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setLoading(false);
  }

  return (
    <Button
      variant="surface"
      size="lg"
      block
      onClick={signIn}
      loading={loading}
    >
      {!loading && <IconGoogle size={20} />}
      {t("login.continueGoogle")}
    </Button>
  );
}
