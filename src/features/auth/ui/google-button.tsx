"use client";

import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured } from "@/shared/config/env";
import { useI18n } from "@/shared/i18n";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { withTimeout } from "@/shared/lib/request-timeout";
import { Button, ErrorNote, IconGoogle } from "@/shared/ui";

export function GoogleSignInButton() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const activeAttempt = useRef(0);

  useEffect(() => {
    // Back from Google's page can restore the disabled button from BFCache.
    const restored = () => { activeAttempt.current += 1; setLoading(false); };
    window.addEventListener("pageshow", restored);
    return () => { window.removeEventListener("pageshow", restored); activeAttempt.current += 1; };
  }, []);

  async function signIn() {
    const attempt = ++activeAttempt.current;
    setLoading(true);
    setFailed(false);
    try {
      const supabase = getSupabaseBrowser();
      // Delay navigation until the bounded operation succeeds; a late result
      // after timeout must never unexpectedly send the user away.
      const { data, error } = await withTimeout(async (signal) => {
        const result = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            skipBrowserRedirect: true,
          },
        });
        signal.throwIfAborted();
        return result;
      });
      if (error) throw error;
      if (!data.url) throw new Error("OAuth redirect unavailable");
      if (attempt === activeAttempt.current) window.location.assign(data.url);
    } catch {
      if (attempt !== activeAttempt.current) return;
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
