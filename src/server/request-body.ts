export class RequestBodyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Enforce the byte limit while reading, before allocating an entire body. */
export async function readJsonObject(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError(400,"JSON object required");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyError(413,"Request too large");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new RequestBodyError(400,"Invalid JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestBodyError(400,"JSON object required");
  return body as Record<string, unknown>;
}
