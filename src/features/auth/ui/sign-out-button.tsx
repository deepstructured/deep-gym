"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/shared/i18n";
import { NEW_WORKOUT_DRAFT_STORAGE_KEY } from "@/shared/config/storage";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { Button, IconLogout } from "@/shared/ui";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const { error } = await getSupabaseBrowser().auth.signOut();
    if (error) {
      setLoading(false);
      return;
    }
    localStorage.removeItem(NEW_WORKOUT_DRAFT_STORAGE_KEY);
    queryClient.clear();
    // A full navigation also clears the in-memory Zustand instance, so the
    // removed local draft cannot survive a sign-out inside this SPA session.
    window.location.assign("/login");
  }

  return (
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
  );
}
