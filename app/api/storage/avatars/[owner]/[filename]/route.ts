import { getAuthenticatedUser } from "@/server/auth";
import { MAX_AVATAR_BYTES, avatarLocation, readAvatar, writeAvatar, removeAvatar } from "@/server/avatars";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ owner: string; filename: string }> };
const failure = (status: number, code: string) => Response.json({ data: null, error: { code, message: code } }, { status, headers: { "Cache-Control": "no-store" } });
const enabled = () => process.env.NEXT_PUBLIC_BACKEND === "postgres";

export async function GET(_request: Request, context: Context) {
  if (!enabled()) return failure(404, "NOT_FOUND");
  const { owner, filename } = await context.params;
  try {
    const image = await readAvatar(owner, filename);
    if (!image) return failure(404, "NOT_FOUND");
    return new Response(new Uint8Array(image.bytes), { headers: {
      "Content-Type": image.mime, "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch { return failure(503, "STORAGE_UNAVAILABLE"); }
}

async function mutate(request: Request, context: Context, remove: boolean) {
  if (!enabled()) return failure(404, "NOT_FOUND");
  const { owner, filename } = await context.params;
  if (!avatarLocation(owner, filename)) return failure(400, "INVALID_PATH");
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(process.env.APP_ORIGIN || request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site" ||
    (!origin && request.headers.get("cookie") && !request.headers.get("authorization"))) return failure(403, "FORBIDDEN");
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return failure(401, "UNAUTHENTICATED");
    if (user.id !== owner) return failure(403, "FORBIDDEN");
    if (remove) await removeAvatar(owner, filename);
    else {
      if (Number(request.headers.get("content-length") || 0) > MAX_AVATAR_BYTES) return failure(413, "PAYLOAD_TOO_LARGE");
      const reader = request.body?.getReader();
      if (!reader) return failure(400, "INVALID_AVATAR");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_AVATAR_BYTES) { await reader.cancel(); return failure(413, "PAYLOAD_TOO_LARGE"); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      await writeAvatar(owner, filename, Buffer.concat(chunks));
    }
    return Response.json({ data: { path: `${owner}/${filename}` }, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if ((error as Error).message === "INVALID_AVATAR") return failure(400, "INVALID_AVATAR");
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return failure(409, "ALREADY_EXISTS");
    return failure(503, "STORAGE_UNAVAILABLE");
  }
}
export const POST = (request: Request, context: Context) => mutate(request, context, false);
export const DELETE = (request: Request, context: Context) => mutate(request, context, true);
