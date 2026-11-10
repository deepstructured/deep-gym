/** Read every page, including when the server's max_rows is below our page
 * size. Request an exact count on the first page and advance by the number
 * actually returned, never by the requested range. */
export async function readAllPages<T>(
  read: (page: { from: number; to: number; count: "exact" | undefined }) => PromiseLike<{
    data: T[] | null;
    error: unknown;
    count?: number | null;
  }>,
  signal?: AbortSignal,
  pageSize = 200,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("Invalid page size");
  const rows: T[] = [];
  let total: number | null = null;
  for (;;) {
    signal?.throwIfAborted();
    const page = await read({
      from: rows.length,
      to: rows.length + pageSize - 1,
      count: rows.length === 0 ? "exact" : undefined,
    });
    signal?.throwIfAborted();
    if (page.error) throw page.error;
    if (total == null && page.count != null) total = page.count;
    const next = page.data ?? [];
    if (next.length === 0) {
      if (total != null && rows.length < total) {
        throw new Error("The dataset changed while loading. Please retry.");
      }
      return rows;
    }
    rows.push(...next);
    if (total != null && rows.length >= total) return rows;
    // A short page does not imply EOF: PostgREST may enforce a smaller cap.
  }
}

/** Keep IN filters below URL limits and bound the number of active requests. */
export async function readIdBatches<T>(
  ids: readonly string[],
  read: (ids: string[]) => Promise<T[]>,
): Promise<T[]> {
  const unique = [...new Set(ids)];
  const rows: T[] = [];
  for (let offset = 0; offset < unique.length; offset += 150) {
    const batches = [0, 50, 100]
      .map((step) => unique.slice(offset + step, offset + step + 50))
      .filter((batch) => batch.length > 0);
    const pages = await Promise.all(batches.map(read));
    pages.forEach((page) => rows.push(...page));
  }
  return rows;
}
