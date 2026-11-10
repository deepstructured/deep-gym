import "server-only";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export function avatarDirectory(owner: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(owner)) throw new Error("INVALID_AVATAR_OWNER");
  return join(resolve(process.env.AVATAR_STORAGE_DIR || "artifacts/storage/avatars"), owner);
}
export function avatarLocation(owner: string, filename: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(owner) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,159}\.(?:jpe?g|png|webp)$/i.test(filename) || filename.includes("..")) return null;
  const directory = avatarDirectory(owner);
  return { directory, file: join(directory, filename) };
}
export async function removeAccountAvatars(owner: string) {
  await rm(avatarDirectory(owner), { recursive: true, force: true });
}
export function avatarMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP") return "image/webp";
  return null;
}
export async function readAvatar(owner: string, filename: string) {
  const location = avatarLocation(owner, filename);
  if (!location) return null;
  try {
    const bytes = await readFile(location.file);
    const mime = avatarMime(bytes);
    return mime ? { bytes, mime } : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function writeAvatar(owner: string, filename: string, bytes: Uint8Array) {
  const location = avatarLocation(owner, filename);
  const mime = avatarMime(bytes);
  if (!location || !mime || bytes.length > MAX_AVATAR_BYTES) throw new Error("INVALID_AVATAR");
  const extension = filename.split(".").pop()!.toLowerCase();
  if (!(mime === "image/jpeg" ? ["jpg", "jpeg"] : [mime.slice(6)]).includes(extension)) throw new Error("INVALID_AVATAR");
  await mkdir(location.directory, { recursive: true, mode: 0o700 });
  // Unique URLs are immutable; no silent replacement of an existing file.
  await writeFile(location.file, bytes, { flag: "wx", mode: 0o600 });
}
export async function removeAvatar(owner: string, filename: string) {
  const location = avatarLocation(owner, filename);
  if (!location) throw new Error("INVALID_AVATAR");
  try { await unlink(location.file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
