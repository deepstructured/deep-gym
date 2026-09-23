import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/lib/supabase/admin";

const AVATAR_BATCH_SIZE = 100;
const MAX_AVATAR_LIST_CALLS = 250;

/**
 * Storage folders are virtual entries (id = null). Always list from offset 0:
 * removing a page shifts the next page into its place. The work limit keeps a
 * request bounded; a later request can continue from the files left behind.
 */
async function removeAvatarTree(admin: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const bucket = admin.storage.from("avatars");
  const pending = [userId];
  let listCalls = 0;

  while (pending.length) {
    const folder = pending.pop()!;
    if (++listCalls > MAX_AVATAR_LIST_CALLS) {
      throw new Error("avatar_cleanup_limit");
    }
    const { data: objects, error: listError } = await bucket.list(folder, {
      limit: AVATAR_BATCH_SIZE,
      offset: 0,
    });
    if (listError) throw listError;
    if (!objects?.length) continue;

    const files: string[] = [];
    const children: string[] = [];
    for (const object of objects) {
      if (!object.name || object.name === "." || object.name === ".." || object.name.includes("/")) {
        throw new Error("invalid_avatar_object_name");
      }
      const path = `${folder}/${object.name}`;
      if (object.id == null) children.push(path);
      else files.push(path);
    }

    if (files.length) {
      const { error: removeError } = await bucket.remove(files);
      if (removeError) throw removeError;
    }

    // Visit children before rescanning this parent. Once their files are gone,
    // Storage stops returning those virtual folder entries.
    pending.push(folder, ...children);
  }
}

function safeErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[a-zA-Z0-9_-]{1,32}$/.test(code)
    ? code
    : undefined;
}

/**
 * Account deletion is initiated by an authenticated device. The service-role
 * key stays server-side. Telegram links and avatar objects must be removed
 * explicitly. Rows with auth.users FKs cascade, except that custom muscle
 * groups are restricted by exercises and require ordered cleanup first.
 */
export async function DELETE(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = /^Bearer (\S+)$/i.exec(authorization)?.[1];
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let phase = "authenticate";
  try {
    const admin = getSupabaseAdmin();
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const userId = auth.user.id;

    phase = "read_telegram_identity";
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("telegram_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw profileError;

    // Auth deletion cannot clean Storage objects. This is safe to repeat after
    // a partial failure because each pass only touches this user's folder.
    phase = "delete_avatars";
    await removeAvatarTree(admin, userId);

    phase = "read_telegram_links";
    const { data: links, error: linksError } = await admin
      .from("telegram_links")
      .select("telegram_id")
      .eq("user_id", userId);
    if (linksError) throw linksError;
    const telegramIds = [...new Set([
      profile?.telegram_id,
      ...(links ?? []).map((link) => link.telegram_id),
    ].filter((id): id is number => id != null))];
    if (telegramIds.length) {
      phase = "delete_telegram_otps";
      const { error: otpError } = await admin
        .from("telegram_otps")
        .delete()
        .in("telegram_id", telegramIds);
      if (otpError) throw otpError;
    }
    phase = "delete_telegram_links";
    const { error: linkError } = await admin
      .from("telegram_links")
      .delete()
      .eq("user_id", userId);
    if (linkError) throw linkError;

    // The first two deletes cascade to their child rows. Deleting exercises
    // then clears any remaining workout/template references, and only after
    // that can custom muscle groups pass the RESTRICT FK. Every delete is
    // scoped to this user and succeeds again if an earlier attempt did it.
    for (const table of ["workouts", "workout_templates", "exercises", "muscle_groups"] as const) {
      phase = `delete_${table}`;
      const { error } = await admin.from(table).delete().eq("user_id", userId);
      if (error) throw error;
    }

    // Other user-owned rows (profile, body-weight log, drafts) cascade when
    // Auth removes the user. This is the last irreversible step.
    phase = "delete_auth_user";
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      // The DELETE may have succeeded before the Auth API response was lost.
      // Verify that specific ambiguity while the caller's identity is still
      // known; a later request cannot authenticate with a deleted session.
      phase = "verify_auth_deletion";
      const { error: lookupError } = await admin.auth.admin.getUserById(userId);
      if (lookupError?.code !== "user_not_found" && lookupError?.status !== 404) {
        throw deleteError;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Supabase errors may contain request details. Log only an internal phase
    // and a constrained code; never the token, raw error, or service key.
    console.error("Account deletion failed", { phase, code: safeErrorCode(error) });
    return NextResponse.json(
      { error: "Could not delete this account. Please try again." },
      { status: 500 },
    );
  }
}
