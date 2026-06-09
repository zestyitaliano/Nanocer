// Manual pricing/availability import triggered from the dashboard. Unlike the
// webhook, this runs under the operator's own session, so RLS enforces ownership
// (no service-role needed — owners can write their own floor_plans). Accepts a
// CSV/JSON file upload or a JSON body. Pass ?mode=full to mark missing sync rows
// unavailable; default 'partial' only upserts what's present.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyPlanSync } from "@/lib/sync/applyPlanSync";
import { parseCsv, parseJson } from "@/lib/sync/parse";
import type { IncomingPlanRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_FIELDS = ["price", "price_max", "price_unit", "availability", "available_text"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: listingId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // RLS scopes this to listings the user owns.
  const { data: listing } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  // Field whitelist comes from the listing's sync config when present.
  const { data: source } = await supabase
    .from("listing_sync_sources")
    .select("synced_fields")
    .eq("listing_id", listingId)
    .maybeSingle();
  const syncedFields = source?.synced_fields ?? DEFAULT_FIELDS;

  const mode = request.nextUrl.searchParams.get("mode") === "full" ? "full" : "partial";

  // Parse from a file upload or a JSON body.
  let rows: IncomingPlanRow[] = [];
  const ctype = request.headers.get("content-type") ?? "";
  try {
    if (ctype.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
      }
      const text = await file.text();
      rows = file.name.toLowerCase().endsWith(".json")
        ? parseJson(JSON.parse(text))
        : parseCsv(text);
    } else {
      rows = parseJson(await request.json());
    }
  } catch {
    return NextResponse.json({ error: "Could not parse the file." }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows found (each row needs an external_id / id)." },
      { status: 422 },
    );
  }

  try {
    const result = await applyPlanSync(supabase, listingId, rows, {
      mode,
      syncedFields,
      userId: user.id,
    });
    await supabase
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
    const msg = e instanceof Error ? e.message : "import failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
