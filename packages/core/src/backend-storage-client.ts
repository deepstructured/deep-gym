/** Uses the authenticated transport provided by the auth client on web/native. */
export function createBackendStorageClient(
  authenticatedFetch: (path: string, init?: RequestInit) => Promise<Response>,
  apiOrigin: string,
) {
  const pathUrl = (path: string) => `/api/storage/avatars/${path.split("/").map(encodeURIComponent).join("/")}`;
  return {
    from(bucket: string) {
      if (bucket !== "avatars") throw new Error("Unsupported storage bucket");
      return {
        async upload(path: string, body: BodyInit, options?: { contentType?: string }) {
          const result = await authenticatedFetch(pathUrl(path), { method: "POST", body, headers: { "Content-Type": options?.contentType || "application/octet-stream" } });
          return result.json();
        },
        getPublicUrl(path: string) { return { data: { publicUrl: `${apiOrigin.replace(/\/$/, "")}${pathUrl(path)}` } }; },
        async remove(paths: string[]) {
          const data = [];
          for (const path of paths) {
            const result = await authenticatedFetch(pathUrl(path), { method: "DELETE" });
            const body = await result.json();
            if (body.error) return body;
            data.push(body.data);
          }
          return { data, error: null };
        },
      };
    },
  };
}
