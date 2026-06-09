// Inbound pricing/availability webhook. An operator's PMS (or middleware) POSTs
// a JSON snapshot here; we authenticate with the per-listing webhook_secret and
// merge via applyPlanSync. Uses the service-role admin client (no user session),
// the same trust boundary as the public /r/[code] redirect — auth is the secret,
// scoped strictly to the listingId in the URL.
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyPlanSync } from "@/lib/sync/applyPlanSync";
import { parseJson } from "@/lib/sync/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // timingSafeEqual requires equal length
  return timingSafeEqual(a, b);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  const { listingId } = await params;
  const admin = createAdminClient();

  const { data: source } = await admin
    .from("listing_sync_sources")
    .select("user_id, enabled, webhook_secret, synced_fields")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (!source || !source.enabled) {
    return NextResponse.json({ error: "Sync not enabled for this listing." }, { status: 404 });
  }

  // Secret via Authorization: Bearer <secret>, x-nanocer-signature, or ?token=.
  const auth = request.headers.get("authorization") ?? "";
  const provided =
    (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "") ||
    request.headers.get("x-nanocer-signature") ||
    request.nextUrl.searchParams.get("token") ||
    "";
  if (!provided || !secretMatches(provided, source.webhook_secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mode =
    (body as { mode?: string })?.mode === "full" ? "full" : ("partial" as const);
  const rows = parseJson(body);

  try {
    const result = await applyPlanSync(admin, listingId, rows, {
      mode,
      syncedFields: source.synced_fields,
      userId: source.user_id,
    });
    await admin
      .from("listing_sync_sources")
      .update({
        last_synced_at: new Date().toISOString(),
        last_status: "ok",
        last_error: null,
        last_row_count: rows.length,
      })
      .eq("listing_id", listingId);
    return NextResponse.json({ ok: true, received: rows.length, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync failed";
    await admin
      .from("listing_sync_sources")
      .update({ last_status: "error", last_error: msg, last_row_count: rows.length })
      .eq("listing_id", listingId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
