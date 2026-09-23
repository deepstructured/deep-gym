"use client";

import { useState } from "react";
import { isSupabaseConfigured } from "@/shared/config/env";
import { useI18n } from "@/shared/i18n";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { Button, ErrorNote, IconGoogle } from "@/shared/ui";

export function GoogleSignInButton() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setLoading(true);
    setFailed(false);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch {
      setFailed(true);
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="surface"
        size="lg"
        block
        onClick={signIn}
        loading={loading}
        disabled={!isSupabaseConfigured}
      >
        {!loading && <IconGoogle size={20} />}
        {t("login.continueGoogle")}
      </Button>
      {failed && <ErrorNote message={t("login.googleFailed")} />}
    </>
  );
}
