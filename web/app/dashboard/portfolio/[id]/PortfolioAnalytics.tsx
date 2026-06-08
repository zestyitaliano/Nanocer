"use client";

// Portfolio rollup: aggregate scans + leads across all the portfolio's listings,
// with a per-listing breakdown of which community performs.
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Portfolio } from "@/lib/types";

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

function Bars({ series, color }: { series: { day: string; n: number }[]; color: string }) {
  const peak = Math.max(1, ...series.map((s) => s.n));
  return (
    <div className="flex items-end gap-0.5 h-24">
      {series.map((s, i) => (
        <div key={s.day} className="flex-1 flex flex-col items-center justify-end">
          <div className="w-full rounded-t" style={{ height: `${(s.n / peak) * 100}%`, minHeight: s.n ? 2 : 0, background: color }} title={`${s.day}: ${s.n}`} />
          {i % 5 === 0 && <div className="text-[8px] text-[var(--muted)] mt-0.5">{s.day.slice(5)}</div>}
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
          <span className="w-28 truncate text-[var(--muted)]">{r.label}</span>
          <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
            <div className="h-full bg-violet-400 rounded-full" style={{ width: `${(r.n / total) * 100}%` }} />
          </div>
          <span className="w-8 text-right tabular-nums">{r.n}</span>
        </div>
      ))}
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

export default function PortfolioAnalytics({
  portfolio,
  listings,
  codes,
  scanEvents,
  leads,
}: {
  portfolio: Portfolio;
  listings: { id: string; name: string; address: string | null }[];
  codes: { listing_id: string; short_code: string; scan_count: number }[];
  scanEvents: { short_code: string; scanned_at: string; country: string | null; user_agent: string | null }[];
  leads: { listing_id: string; created_at: string }[];
}) {
  const router = useRouter();
  const days = lastNDays(DAYS);
  const nameOf = (id: string) => {
    const l = listings.find((x) => x.id === id);
    return l?.name || l?.address || "(untitled)";
  };

  const totalScans = useMemo(() => codes.reduce((a, c) => a + (c.scan_count ?? 0), 0), [codes]);
  const conv = totalScans > 0 ? Math.round((leads.length / totalScans) * 100) : 0;

  const scanSeries = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of scanEvents) m[s.scanned_at.slice(0, 10)] = (m[s.scanned_at.slice(0, 10)] ?? 0) + 1;
    return days.map((d) => ({ day: d, n: m[d] ?? 0 }));
  }, [scanEvents, days]);
  const leadSeries = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of leads) m[l.created_at.slice(0, 10)] = (m[l.created_at.slice(0, 10)] ?? 0) + 1;
    return days.map((d) => ({ day: d, n: m[d] ?? 0 }));
  }, [leads, days]);

  const scansByListing = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of codes) m[c.listing_id] = (m[c.listing_id] ?? 0) + (c.scan_count ?? 0);
    return Object.entries(m).map(([id, n]) => ({ label: nameOf(id), n })).sort((a, b) => b.n - a.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes, listings]);
  const leadsByListing = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of leads) m[l.listing_id] = (m[l.listing_id] ?? 0) + 1;
    return Object.entries(m).map(([id, n]) => ({ label: nameOf(id), n })).sort((a, b) => b.n - a.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, listings]);

  const countries = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of scanEvents) { const k = s.country || "Unknown"; m[k] = (m[k] ?? 0) + 1; }
    return Object.entries(m).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 6);
  }, [scanEvents]);
  const devices = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of scanEvents) { const k = device(s.user_agent); m[k] = (m[k] ?? 0) + 1; }
    return Object.entries(m).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  }, [scanEvents]);

  return (
    <main className="min-h-screen">
      <header className="bg-white/70 backdrop-blur border-b border-[var(--border)] px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => { router.push("/dashboard"); router.refresh(); }} className="btn btn-secondary btn-sm">
          ← Dashboard
        </button>
        <span className="text-sm font-semibold truncate">{portfolio.name || "Portfolio"}</span>
        <span className="text-xs text-[var(--muted)]">· {listings.length} listings</span>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Listings" value={listings.length} />
          <Stat label="Total scans" value={totalScans} />
          <Stat label="Leads" value={leads.length} />
          <Stat label="Conversion" value={`${conv}%`} />
        </div>

        <div className="card p-4">
          <div className="text-sm font-semibold mb-2">Scans · last {DAYS} days</div>
          <Bars series={scanSeries} color="#7c5cff" />
        </div>
        <div className="card p-4">
          <div className="text-sm font-semibold mb-2">Leads · last {DAYS} days</div>
          <Bars series={leadSeries} color="#10b981" />
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="card p-4">
            <div className="text-sm font-semibold mb-3">Scans by listing</div>
            <Breakdown rows={scansByListing} />
          </div>
          <div className="card p-4">
            <div className="text-sm font-semibold mb-3">Leads by listing</div>
            <Breakdown rows={leadsByListing} />
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
      </div>
    </main>
  );
}
