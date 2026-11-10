"use client";

import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { withTimeout } from "@/shared/lib/request-timeout";
import { resetLocalAuthSession } from "@/shared/lib/auth-session";
import { Button, ErrorNote, IconLogout } from "@/shared/ui";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setLoading(true);
    setFailed(false);
    try {
      const { error } = await withTimeout(async (signal) => {
        const result = await getSupabaseBrowser().auth.signOut({ scope: "local" });
        signal.throwIfAborted();
        return result;
      });
      if (error) throw error;
      // Auth identity subscribers clear the query cache and archive the draft.
      window.location.assign("/login");
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <Button
      variant={compact ? "ghost" : "danger"}
      size={compact ? "sm" : "lg"}
      tone={compact ? "faint" : undefined}
      block={!compact}
      onClick={signOut}
      loading={loading}
    >
      {!loading && <IconLogout size={19} />}
      {t("settings.signOut")}
    </Button>
    {failed && <>
      <ErrorNote message={t("common.error")} />
      <Button type="button" variant="ghost" onClick={resetLocalAuthSession}>
        {t("auth.resetLocalSession")}
      </Button>
    </>}
    </>
  );
}
