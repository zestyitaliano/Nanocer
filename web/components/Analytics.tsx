"use client";

// Per-code scan analytics: total, last-scanned, and a 14-day bar chart built from
// the scan_events table (owner-readable via RLS). Mirrors the desktop stats view.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QrCode } from "@/lib/types";

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default function Analytics({ code }: { code: QrCode }) {
  const supabase = createClient();
  const [series, setSeries] = useState<{ day: string; n: number }[]>([]);
  const [last, setLast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const since = lastNDays(14)[0] + "T00:00:00Z";
      const { data } = await supabase
        .from("scan_events")
        .select("scanned_at")
        .eq("short_code", code.short_code)
        .gte("scanned_at", since);
      if (!active) return;
      const counts: Record<string, number> = {};
      let latest: string | null = null;
      (data ?? []).forEach((r: { scanned_at: string }) => {
        const day = r.scanned_at.slice(0, 10);
        counts[day] = (counts[day] ?? 0) + 1;
        if (!latest || r.scanned_at > latest) latest = r.scanned_at;
      });
      setSeries(lastNDays(14).map((day) => ({ day, n: counts[day] ?? 0 })));
      setLast(latest);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [code.short_code, supabase]);

  if (!code.is_dynamic) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Static codes aren&apos;t tracked — they encode their content directly.
      </p>
    );
  }

  const peak = Math.max(1, ...series.map((s) => s.n));

  return (
    <div className="space-y-3">
      <div className="text-sm">
        <span className="font-medium">Total scans:</span> {code.scan_count}
        {"   "}
        <span className="font-medium ml-3">Last scan:</span>{" "}
        {last ? new Date(last).toLocaleString() : "never"}
      </div>
      <div className="card p-4">
        <div className="text-xs text-[var(--muted)] mb-2">Scans, last 14 days</div>
        {loading ? (
          <div className="text-xs text-[var(--muted)]">loading…</div>
        ) : (
          <div className="flex items-end gap-1 h-24">
            {series.map((s) => (
              <div key={s.day} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full brand-gradient rounded-t-md"
                  style={{ height: `${(s.n / peak) * 100}%`, minHeight: s.n ? 2 : 0 }}
                  title={`${s.day}: ${s.n}`}
                />
                <div className="text-[8px] text-[var(--muted)] mt-1">
                  {s.day.slice(5)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
