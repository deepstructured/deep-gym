/**
 * Next.js can construct request URLs from its container bind address. Use an
 * explicit deployment origin for redirects when a reverse proxy is in front.
 * Forwarded headers are deliberately not used as a source of trust here.
 */
export function getServerRedirectBase(
  requestUrl: string,
  appOrigin: string | undefined = process.env.APP_ORIGIN,
): URL {
  const request = new URL(requestUrl);
  if (!appOrigin) return request;

  let configured: URL;
  try {
    configured = new URL(appOrigin);
  } catch {
    throw new Error("APP_ORIGIN must be an HTTP(S) origin without a path, credentials, query, or fragment");
  }
  if (
    !["http:", "https:"].includes(configured.protocol) ||
    configured.username ||
    configured.password ||
    configured.pathname !== "/" ||
    configured.search ||
    configured.hash ||
    ![configured.origin, `${configured.origin}/`].includes(appOrigin)
  ) {
    throw new Error("APP_ORIGIN must be an HTTP(S) origin without a path, credentials, query, or fragment");
  }

  // Assign each component instead of resolving the path against the origin:
  // a request path beginning with // must never replace the configured host.
  configured.pathname = request.pathname;
  configured.search = request.search;
  configured.hash = request.hash;
  return configured;
}

/** OAuth may only return to a path on this application. */
export function safeLocalRedirectPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return "/";
  }
  return value;
}
