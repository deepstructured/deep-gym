import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkoutDraft } from "./draft";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/auth-provider";

/** Delete through the deployed Next API, where the service-role key stays private. */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const { clearDeletedSession } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const baseUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "");
      if (!baseUrl) throw new Error("EXPO_PUBLIC_WEB_URL is not configured");
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Sign in again before deleting your account");
      const response = await fetch(`${baseUrl}/api/account/delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || `Could not delete account (${response.status})`);
      }
      useWorkoutDraft.getState().forgetOwner(session.user.id);
      await clearDeletedSession(session.user.id);
      queryClient.clear();
    },
  });
}
