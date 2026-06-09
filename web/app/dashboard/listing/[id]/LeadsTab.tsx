"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/types";

// Badge colors per pipeline stage.
const STATUS_CLS: Record<LeadStatus, string> = {
  uncontacted: "bg-amber-100 text-amber-800",
  contacted: "bg-sky-100 text-sky-800",
  touring: "bg-violet-100 text-violet-800",
  applied: "bg-indigo-100 text-indigo-800",
  leased: "bg-emerald-100 text-emerald-800",
  lost: "bg-neutral-200 text-neutral-600",
};

interface TeamMember {
  user_id: string;
  email: string | null;
}

export default function LeadsTab({ listingId }: { listingId: string }) {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [members, setMembers] = useState<TeamMember[]>([]);

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

  // Team members (for the assignment dropdown). Owner-only API; returns empty
  // for non-owners, in which case the Assigned column stays read-only.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/team?listingId=${listingId}`);
        const json = await res.json();
        if (active) setMembers((json.members ?? []) as TeamMember[]);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      active = false;
    };
  }, [listingId]);

  async function assign(lead: Lead, userId: string | null) {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, assigned_to: userId } : l)));
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: userId })
      .eq("id", lead.id);
    if (error) {
      setLeads(prev);
      alert(error.message);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this lead?")) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) return alert(error.message);
    setLeads((ls) => ls.filter((l) => l.id !== id));
  }

  async function setStatus(lead: Lead, status: LeadStatus) {
    const now = new Date().toISOString();
    const patch: Partial<Lead> = { status, status_updated_at: now };
    // Stamp first-contact time the first time a lead leaves "uncontacted".
    if (status !== "uncontacted" && !lead.contacted_at) patch.contacted_at = now;

    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, ...patch } : l)));
    const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
    if (error) {
      setLeads(prev); // revert on failure
      alert(error.message);
    }
  }

  const shown = useMemo(
    () => (filter === "all" ? leads : leads.filter((l) => (l.status ?? "uncontacted") === filter)),
    [leads, filter],
  );

  function exportCsv() {
    const rows = [
      ["name", "phone", "email", "message", "source", "status", "contacted_at", "assigned_to", "created_at"],
      ...leads.map((l) => [
        l.name ?? "",
        l.phone ?? "",
        l.email ?? "",
        (l.message ?? "").replace(/[\r\n,]+/g, " "),
        l.source ?? "",
        l.status ?? "uncontacted",
        l.contacted_at ?? "",
        l.assigned_to ?? "",
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
      <div className="flex justify-between items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
        <span className="text-sm font-semibold">{leads.length} leads</span>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as LeadStatus | "all")}
            className="input text-sm py-1.5"
          >
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button onClick={exportCsv} className="btn btn-secondary btn-sm">
            Export CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-[var(--muted)] text-xs">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Name</th>
              <th className="text-left px-4 py-2.5 font-semibold">Phone</th>
              <th className="text-left px-4 py-2.5 font-semibold">Email</th>
              <th className="text-left px-4 py-2.5 font-semibold">Status</th>
              <th className="text-left px-4 py-2.5 font-semibold">Assigned</th>
              <th className="text-left px-4 py-2.5 font-semibold">Message</th>
              <th className="text-left px-4 py-2.5 font-semibold">When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const status = l.status ?? "uncontacted";
              return (
                <tr key={l.id} className="border-t border-[var(--border)] hover:bg-neutral-50/60">
                  <td className="px-4 py-2.5 font-medium">{l.name}</td>
                  <td className="px-4 py-2.5">
                    {l.phone && <a href={`tel:${l.phone}`} className="brand-text font-medium">{l.phone}</a>}
                  </td>
                  <td className="px-4 py-2.5">{l.email}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={status}
                        onChange={(e) => setStatus(l, e.target.value as LeadStatus)}
                        className={`text-xs font-semibold rounded px-2 py-1 border-0 cursor-pointer ${STATUS_CLS[status]}`}
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      {l.escalated_at && (
                        <span
                          title={`Escalated ${new Date(l.escalated_at).toLocaleString()}`}
                          className="text-xs font-semibold rounded px-2 py-0.5 bg-red-100 text-red-700"
                        >
                          ⚠ Escalated
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {members.length > 0 ? (
                      <select
                        value={l.assigned_to ?? ""}
                        onChange={(e) => assign(l, e.target.value || null)}
                        className="input text-xs py-1"
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.email ?? m.user_id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[var(--muted)]">{l.assigned_to ? "Assigned" : "—"}</span>
                    )}
                  </td>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
