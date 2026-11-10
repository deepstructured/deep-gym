/** Process liveness only. Check Supabase separately so an upstream outage does
 * not turn into a restart loop for an otherwise healthy application server. */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
