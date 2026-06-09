// The sync merge core. Shared by the webhook receiver and the manual importer so
// the trigger (webhook vs upload) and format (CSV vs JSON) are decoupled from the
// merge rules.
//
// Guarantees (the whole point of this module):
//   • Only whitelisted columns (syncedFields) are ever written.
//   • Only rows the sync owns (source='sync') and that are still sync_enabled
//     are updated. Manual rows are never matched or modified.
//   • Nothing is ever deleted. In 'full' mode, sync-owned rows missing from the
//     snapshot are marked unavailable (only if 'availability' is whitelisted).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FloorPlan, IncomingPlanRow } from "@/lib/types";

// Columns a sync is allowed to touch (besides bookkeeping). external_id/source
// are managed by the engine, not the whitelist.
const SYNCABLE = [
  "name",
  "beds",
  "baths",
  "sqft",
  "price",
  "price_max",
  "price_unit",
  "availability",
  "available_text",
] as const;

export interface SyncOpts {
  mode?: "full" | "partial"; // default 'partial' (webhook deltas)
  syncedFields: string[];
  userId: string; // owner — required to insert new rows
}

export interface SyncResult {
  matched: number;
  inserted: number;
  skipped: number; // pinned (sync_enabled=false)
  markedUnavailable: number;
}

function pick(row: IncomingPlanRow, fields: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of SYNCABLE) {
    if (fields.has(f) && row[f as keyof IncomingPlanRow] !== undefined) {
      out[f] = row[f as keyof IncomingPlanRow];
    }
  }
  return out;
}

export async function applyPlanSync(
  supabase: SupabaseClient,
  listingId: string,
  rows: IncomingPlanRow[],
  opts: SyncOpts,
): Promise<SyncResult> {
  const mode = opts.mode ?? "partial";
  const fields = new Set(opts.syncedFields);
  const now = new Date().toISOString();

  const { data: existingData, error } = await supabase
    .from("floor_plans")
    .select("id, external_id, source, sync_enabled")
    .eq("listing_id", listingId);
  if (error) throw new Error(error.message);

  const existing = (existingData ?? []) as Pick<
    FloorPlan,
    "id" | "external_id" | "source" | "sync_enabled"
  >[];
  const byExternal = new Map<string, (typeof existing)[number]>();
  for (const p of existing) {
    if (p.external_id) byExternal.set(p.external_id, p);
  }

  const result: SyncResult = { matched: 0, inserted: 0, skipped: 0, markedUnavailable: 0 };
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row.external_id) continue;
    seen.add(row.external_id);
    const match = byExternal.get(row.external_id);

    if (match) {
      if (match.sync_enabled === false) {
        result.skipped++;
        continue;
      }
      const patch = pick(row, fields);
      const { error: upErr } = await supabase
        .from("floor_plans")
        .update({ ...patch, source: "sync", last_synced_at: now, synced_fields: opts.syncedFields })
        .eq("id", match.id);
      if (upErr) throw new Error(upErr.message);
      result.matched++;
    } else {
      // New unit from the feed. Whitelisted fields + bookkeeping; name must be
      // non-null (DB default ''), so fall back to the external id.
      const patch = pick(row, fields);
      const { error: insErr } = await supabase.from("floor_plans").insert({
        listing_id: listingId,
        user_id: opts.userId,
        name: (row.name ?? "").trim() || row.external_id,
        external_id: row.external_id,
        source: "sync",
        last_synced_at: now,
        synced_fields: opts.syncedFields,
        ...patch,
      });
      if (insErr) throw new Error(insErr.message);
      result.inserted++;
    }
  }

  // Full snapshot: sync-owned rows absent from the feed go unavailable (never
  // deleted, and only if availability is a field this source manages).
  if (mode === "full" && fields.has("availability")) {
    const stale = existing.filter(
      (p) =>
        p.source === "sync" &&
        p.sync_enabled !== false &&
        p.external_id &&
        !seen.has(p.external_id),
    );
    for (const p of stale) {
      const { error: upErr } = await supabase
        .from("floor_plans")
        .update({ availability: "unavailable", last_synced_at: now })
        .eq("id", p.id);
      if (upErr) throw new Error(upErr.message);
      result.markedUnavailable++;
    }
  }

  return result;
}
