"use client";

// Per-listing pricing/availability sync config. Self-contained: loads (or
// creates) the listing_sync_sources row itself, so it needs no extra props
// threaded through the server page. Lets the operator enable sync, copy/rotate
// the webhook URL + secret, choose which fields the sync owns, and run a manual
// CSV/JSON import.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/api";
import type { ListingSyncSource } from "@/lib/types";

const FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "price_max", label: "Price max" },
  { key: "price_unit", label: "Price unit" },
  { key: "availability", label: "Availability" },
  { key: "available_text", label: "Availability text" },
  { key: "beds", label: "Beds" },
  { key: "baths", label: "Baths" },
  { key: "sqft", label: "Sqft" },
];

function newSecret(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

export default function SyncSettings({
  listingId,
  userId,
}: {
  listingId: string;
  userId: string;
}) {
  const supabase = createClient();
  const [source, setSource] = useState<ListingSyncSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [importMode, setImportMode] = useState<"partial" | "full">("partial");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("listing_sync_sources")
        .select("*")
        .eq("listing_id", listingId)
        .maybeSingle();
      if (active) {
        setSource((data as ListingSyncSource) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [listingId, supabase]);

  const webhookUrl = `${siteUrl().replace(/\/$/, "")}/api/sync/${listingId}`;

  async function enable() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase
      .from("listing_sync_sources")
      .insert({ listing_id: listingId, user_id: userId, webhook_secret: newSecret() })
      .select("*")
      .single();
    setBusy(false);
    if (error) return setMsg(error.message);
    setSource(data as ListingSyncSource);
  }

  async function patch(p: Partial<ListingSyncSource>) {
    if (!source) return;
    const prev = source;
    setSource({ ...source, ...p });
    const { error } = await supabase
      .from("listing_sync_sources")
      .update(p)
      .eq("listing_id", listingId);
    if (error) {
      setSource(prev);
      setMsg(error.message);
    }
  }

  function toggleField(key: string) {
    if (!source) return;
    const set = new Set(source.synced_fields);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    patch({ synced_fields: Array.from(set) });
  }

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/listings/${listingId}/sync?mode=${importMode}`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Import failed (${res.status}).`);
      setMsg(
        `Imported ${json.received} rows · ${json.matched} updated, ${json.inserted} added` +
          (json.skipped ? `, ${json.skipped} pinned` : "") +
          (json.markedUnavailable ? `, ${json.markedUnavailable} marked unavailable` : "") +
          ". Refresh plans to see changes.",
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="border-t border-[var(--border)] pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--muted)]">
          Pricing &amp; availability sync
        </span>
        {!source && (
          <button onClick={enable} disabled={busy} className="btn btn-secondary btn-sm">
            Enable sync
          </button>
        )}
      </div>

      {!source ? (
        <p className="text-xs text-[var(--muted)]">
          Sync floor-plan pricing &amp; availability from an external feed (PMS export,
          middleware, or a CSV/JSON upload) instead of editing by hand. Manual plans stay
          untouched.
        </p>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={source.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
              className="accent-orange-600 w-4 h-4"
            />
            Sync enabled
          </label>

          {/* Webhook endpoint */}
          <div>
            <span className="text-xs text-[var(--muted)]">Webhook URL (POST JSON here)</span>
            <div className="flex items-center gap-1 mt-1">
              <code className="text-xs bg-neutral-100 rounded px-2 py-1 flex-1 truncate">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(webhookUrl)}
                className="brand-text text-xs font-medium"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Secret */}
          <div>
            <span className="text-xs text-[var(--muted)]">
              Secret (send as <code>Authorization: Bearer …</code>)
            </span>
            <div className="flex items-center gap-1 mt-1">
              <code className="text-xs bg-neutral-100 rounded px-2 py-1 flex-1 truncate">
                {showSecret ? source.webhook_secret : "•".repeat(24)}
              </code>
              <button type="button" onClick={() => setShowSecret((s) => !s)} className="brand-text text-xs font-medium">
                {showSecret ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(source.webhook_secret)}
                className="brand-text text-xs font-medium"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => patch({ webhook_secret: newSecret() })}
                className="text-xs text-[var(--muted)] hover:text-red-600"
              >
                Rotate
              </button>
            </div>
          </div>

          {/* Synced fields */}
          <div>
            <span className="text-xs text-[var(--muted)]">Fields the sync manages</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {FIELD_OPTIONS.map((f) => (
                <label key={f.key} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={source.synced_fields.includes(f.key)}
                    onChange={() => toggleField(f.key)}
                    className="accent-orange-600"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          {/* Manual import */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as "partial" | "full")}
              className="input text-sm py-1.5"
            >
              <option value="partial">Update present rows</option>
              <option value="full">Full snapshot (mark missing unavailable)</option>
            </select>
            <label className="btn btn-secondary btn-sm cursor-pointer">
              {busy ? "Importing…" : "Import CSV / JSON"}
              <input type="file" accept=".csv,.json" onChange={importFile} className="hidden" disabled={busy} />
            </label>
          </div>

          {source.last_synced_at && (
            <p className="text-xs text-[var(--muted)]">
              Last synced {new Date(source.last_synced_at).toLocaleString()} · {source.last_status}
              {source.last_row_count != null ? ` · ${source.last_row_count} rows` : ""}
              {source.last_error ? ` · ${source.last_error}` : ""}
            </p>
          )}
        </div>
      )}

      {msg && <p className="text-xs text-[var(--muted)]">{msg}</p>}
    </div>
  );
}
