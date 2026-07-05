"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { Button, IconGoogle } from "@/shared/ui";

export function GoogleSignInButton() {
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
      className="w-full"
      onClick={signIn}
      loading={loading}
    >
      {!loading && <IconGoogle size={20} />}
      Continue with Google
    </Button>
  );
}
