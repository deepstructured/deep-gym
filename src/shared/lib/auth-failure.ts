/** Missing/invalid credentials require sign-in; outages must preserve cookies. */
export function isMissingSession(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: string; code?: string; status?: number };
  return value.name === "AuthSessionMissingError" || value.status === 401 ||
    ["session_not_found", "refresh_token_not_found", "refresh_token_already_used", "bad_jwt"].includes(value.code ?? "");
}

/** Deliberately excludes message/URL: SDK messages can contain sensitive data. */
export function authFailureCode(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown";
  const value = error as { code?: unknown; name?: unknown };
  const code = typeof value.code === "string" ? value.code : value.name;
  return typeof code === "string" && /^[a-zA-Z0-9_]{1,80}$/.test(code) ? code : "unknown";
}
