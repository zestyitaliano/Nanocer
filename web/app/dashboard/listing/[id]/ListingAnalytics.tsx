"use client";

// Per-listing analytics: scans (across the listing's codes) + leads over the last
// 30 days, which code/sign performs, lead sources, geo/device, and which floor
// plans the quiz matched people to. Reads scan_events (owner-readable via RLS
// through codes) and leads (owner-readable via RLS through the listing).
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FloorPlan, Lead, QrCode } from "@/lib/types";

const DAYS = 30;

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function device(ua: string | null): "iOS" | "Android" | "Other" {
  if (!ua) return "Other";
  if (/iphone|ipad|ipod|ios/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  return "Other";
}

type ScanRow = { short_code: string; scanned_at: string; country: string | null; user_agent: string | null };

function Bars({ series, color }: { series: { day: string; n: number }[]; color: string }) {
  const peak = Math.max(1, ...series.map((s) => s.n));
  return (
    <div className="flex items-end gap-0.5 h-24">
      {series.map((s, i) => (
        <div key={s.day} className="flex-1 flex flex-col items-center justify-end">
          <div
            className="w-full rounded-t"
            style={{ height: `${(s.n / peak) * 100}%`, minHeight: s.n ? 2 : 0, background: color }}
            title={`${s.day}: ${s.n}`}
          />
          {i % 5 === 0 && (
            <div className="text-[8px] text-[var(--muted)] mt-0.5">{s.day.slice(5)}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function Breakdown({ rows }: { rows: { label: string; n: number }[] }) {
  const total = rows.reduce((a, r) => a + r.n, 0) || 1;
  if (!rows.length) return <p className="text-xs text-[var(--muted)]">No data yet.</p>;
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-sm">
          <span className="w-24 truncate text-[var(--muted)]">{r.label}</span>
          <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
            <div className="h-full bg-orange-400 rounded-full" style={{ width: `${(r.n / total) * 100}%` }} />
          </div>
          <span className="w-8 text-right tabular-nums">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

export default function ListingAnalytics({
  listingId,
  codes,
  plans = [],
}: {
  listingId: string;
  codes: QrCode[];
  plans?: FloorPlan[];
}) {
  const supabase = createClient();
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const shortCodes = useMemo(() => codes.map((c) => c.short_code), [codes]);
  const totalScans = useMemo(() => codes.reduce((a, c) => a + (c.scan_count ?? 0), 0), [codes]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const since = lastNDays(DAYS)[0] + "T00:00:00Z";
      const [scanRes, leadRes] = await Promise.all([
        shortCodes.length
          ? supabase
              .from("scan_events")
              .select("short_code, scanned_at, country, user_agent")
              .in("short_code", shortCodes)
              .gte("scanned_at", since)
          : Promise.resolve({ data: [] as ScanRow[] }),
        supabase
          .from("leads")
          .select("*")
          .eq("listing_id", listingId)
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      setScans((scanRes.data ?? []) as ScanRow[]);
      setLeads((leadRes.data ?? []) as Lead[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [listingId, shortCodes, supabase]);

  const days = lastNDays(DAYS);

  const scanSeries = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of scans) m[s.scanned_at.slice(0, 10)] = (m[s.scanned_at.slice(0, 10)] ?? 0) + 1;
    return days.map((d) => ({ day: d, n: m[d] ?? 0 }));
  }, [scans, days]);

  const leadSeries = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of leads) m[l.created_at.slice(0, 10)] = (m[l.created_at.slice(0, 10)] ?? 0) + 1;
    return days.map((d) => ({ day: d, n: m[d] ?? 0 }));
  }, [leads, days]);

  // which code/sign performed (scan_count per code)
  const perCode = useMemo(
    () =>
      [...codes]
        .filter((c) => c.is_dynamic)
        .map((c) => ({ label: c.title || c.short_code, n: c.scan_count ?? 0 }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 8),
    [codes],
  );

  // True per-unit scans: sum scans of codes that target each floor plan.
  const planScans = useMemo(() => {
    const byPlan: Record<string, number> = {};
    for (const c of codes) {
      if (c.floor_plan_id) {
        byPlan[c.floor_plan_id] = (byPlan[c.floor_plan_id] ?? 0) + (c.scan_count ?? 0);
      }
    }
    return plans
      .map((p) => ({ label: p.name || "(unnamed plan)", n: byPlan[p.id] ?? 0 }))
      .sort((a, b) => b.n - a.n);
  }, [codes, plans]);

  const sources = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of leads) {
      const k = l.source === "quiz" ? "Floor-plan finder" : "Page form";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  }, [leads]);

  const countries = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of scans) {
      const k = s.country || "Unknown";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 6);
  }, [scans]);

  const devices = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of scans) {
      const k = device(s.user_agent);
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  }, [scans]);

  // floor plans the quiz matched people to (parsed from the lead message)
  const planInterest = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of leads) {
      const line = (l.message ?? "")
        .split("\n")
        .find((x) => x.toLowerCase().startsWith("recommended:"));
      if (!line) continue;
      line
        .slice(line.indexOf(":") + 1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((name) => (m[name] = (m[name] ?? 0) + 1));
    }
    return Object.entries(m).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 8);
  }, [leads]);

  if (loading) return <div className="text-sm text-[var(--muted)]">Loading analytics…</div>;

  const recentScans = scanSeries.reduce((a, s) => a + s.n, 0);
  const conv = totalScans > 0 ? Math.round((leads.length / totalScans) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total scans" value={totalScans} />
        <Stat label={`Scans (${DAYS}d)`} value={recentScans} />
        <Stat label="Leads" value={leads.length} />
        <Stat label="Conversion" value={`${conv}%`} />
      </div>

      <div className="card p-4">
        <div className="text-sm font-semibold mb-2">Scans · last {DAYS} days</div>
        <Bars series={scanSeries} color="#eb5e28" />
      </div>

      <div className="card p-4">
        <div className="text-sm font-semibold mb-2">Leads · last {DAYS} days</div>
        <Bars series={leadSeries} color="#10b981" />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Which code / sign performs</div>
          <Breakdown rows={perCode} />
        </div>
        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Lead sources</div>
          <Breakdown rows={sources} />
        </div>
        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Scans by country</div>
          <Breakdown rows={countries} />
        </div>
        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Scans by device</div>
          <Breakdown rows={devices} />
        </div>
      </div>

      {planScans.length > 0 && (
        <div className="card p-4">
          <div className="text-sm font-semibold mb-1">Scans by floor plan</div>
          <p className="text-xs text-[var(--muted)] mb-3">
            Scans from QR codes that target each unit (per-unit attribution).
          </p>
          <Breakdown rows={planScans} />
        </div>
      )}

      {planInterest.length > 0 && (
        <div className="card p-4">
          <div className="text-sm font-semibold mb-1">Floor-plan interest (from the finder)</div>
          <p className="text-xs text-[var(--muted)] mb-3">
            Which plans the quiz matched leads to.
          </p>
          <Breakdown rows={planInterest} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="font-display text-2xl font-bold tracking-tight leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-xs text-[var(--muted)] mt-1">{label}</div>
    </div>
  );
}
