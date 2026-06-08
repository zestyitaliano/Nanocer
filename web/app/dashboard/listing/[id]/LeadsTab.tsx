"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "@/lib/types";

export default function LeadsTab({ listingId }: { listingId: string }) {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false });
      if (active) {
        setLeads((data ?? []) as Lead[]);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [listingId, supabase]);

  async function remove(id: number) {
    if (!window.confirm("Delete this lead?")) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) return alert(error.message);
    setLeads((ls) => ls.filter((l) => l.id !== id));
  }

  function exportCsv() {
    const rows = [
      ["name", "phone", "email", "message", "source", "created_at"],
      ...leads.map((l) => [
        l.name ?? "",
        l.phone ?? "",
        l.email ?? "",
        (l.message ?? "").replace(/[\r\n,]+/g, " "),
        l.source ?? "",
        l.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="text-sm text-[var(--muted)]">Loading leads…</div>;

  if (leads.length === 0) {
    return (
      <div className="card text-center text-[var(--muted)] text-sm py-16">
        No leads yet. They appear here when someone submits the property page form.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--border)]">
        <span className="text-sm font-semibold">{leads.length} leads</span>
        <button onClick={exportCsv} className="btn btn-secondary btn-sm">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-[var(--muted)] text-xs">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Name</th>
              <th className="text-left px-4 py-2.5 font-semibold">Phone</th>
              <th className="text-left px-4 py-2.5 font-semibold">Email</th>
              <th className="text-left px-4 py-2.5 font-semibold">Message</th>
              <th className="text-left px-4 py-2.5 font-semibold">When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-[var(--border)] hover:bg-neutral-50/60">
                <td className="px-4 py-2.5 font-medium">{l.name}</td>
                <td className="px-4 py-2.5">
                  {l.phone && <a href={`tel:${l.phone}`} className="brand-text font-medium">{l.phone}</a>}
                </td>
                <td className="px-4 py-2.5">{l.email}</td>
                <td className="px-4 py-2.5 max-w-[220px] truncate">{l.message}</td>
                <td className="px-4 py-2.5 text-[var(--muted)] whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => remove(l.id)} className="text-red-400 hover:text-red-600 text-xs">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
