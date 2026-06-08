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

  if (loading) return <div className="text-sm text-neutral-400">Loading leads…</div>;

  if (leads.length === 0) {
    return (
      <div className="text-center text-neutral-400 text-sm py-16 border rounded-xl bg-white">
        No leads yet. They appear here when someone submits the property page form.
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="flex justify-between items-center px-4 py-2 border-b">
        <span className="text-sm font-medium">{leads.length} leads</span>
        <button onClick={exportCsv} className="text-sm text-blue-600">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Phone</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Message</th>
              <th className="text-left px-3 py-2">When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2">{l.name}</td>
                <td className="px-3 py-2">
                  {l.phone && <a href={`tel:${l.phone}`} className="text-blue-600">{l.phone}</a>}
                </td>
                <td className="px-3 py-2">{l.email}</td>
                <td className="px-3 py-2 max-w-[220px] truncate">{l.message}</td>
                <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => remove(l.id)} className="text-red-500 text-xs">
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
