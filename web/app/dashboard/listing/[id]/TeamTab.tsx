"use client";

// Team management for the listing's portfolio. Owner-only. Members can see the
// portfolio's leads and get escalation emails (senior staff / property managers).
// If the listing isn't in a portfolio yet, the owner can create one inline so
// teams work without resurrecting the full portfolio UI.
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TEAM_ROLES, type TeamRole } from "@/lib/types";

interface Member {
  user_id: string;
  role: TeamRole;
  email: string | null;
  created_at: string;
}

export default function TeamTab({
  listingId,
  userId,
}: {
  listingId: string;
  userId: string;
}) {
  const supabase = createClient();
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("leasing_agent");

  const load = useCallback(async () => {
    const res = await fetch(`/api/team?listingId=${listingId}`);
    const json = await res.json();
    setPortfolioId(json.portfolioId ?? null);
    setMembers(json.members ?? []);
    setLoading(false);
  }, [listingId]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  async function createPortfolio() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase
      .from("portfolios")
      .insert({ user_id: userId, name: "My team" })
      .select("id")
      .single();
    if (error) {
      setBusy(false);
      return setMsg(error.message);
    }
    await supabase.from("listings").update({ portfolio_id: data.id }).eq("id", listingId);
    setBusy(false);
    await load();
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/team?listingId=${listingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(json.error || "Could not add member.");
    setEmail("");
    await load();
  }

  async function changeRole(m: Member, newRole: TeamRole) {
    setMembers((ms) => ms.map((x) => (x.user_id === m.user_id ? { ...x, role: newRole } : x)));
    await fetch(`/api/team?listingId=${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: m.user_id, role: newRole }),
    });
  }

  async function removeMember(m: Member) {
    if (!window.confirm(`Remove ${m.email ?? "this member"}?`)) return;
    setMembers((ms) => ms.filter((x) => x.user_id !== m.user_id));
    await fetch(`/api/team?listingId=${listingId}&userId=${m.user_id}`, { method: "DELETE" });
  }

  if (loading) return <div className="text-sm text-[var(--muted)]">Loading team…</div>;

  if (!portfolioId) {
    return (
      <div className="card p-6 max-w-xl space-y-3">
        <p className="text-sm text-[var(--muted)]">
          This property isn&apos;t in a portfolio yet. Create one to add teammates — members
          can see this property&apos;s leads, and senior staff / property managers receive
          escalation alerts for uncontacted leads.
        </p>
        <button onClick={createPortfolio} disabled={busy} className="btn btn-primary">
          {busy ? "Creating…" : "Create a team for this property"}
        </button>
        {msg && <span className="text-sm text-red-600">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="card p-6 max-w-xl space-y-4">
      <form onSubmit={addMember} className="flex gap-2 items-end flex-wrap">
        <label className="flex-1 min-w-[180px]">
          <span className="text-xs text-[var(--muted)]">Add teammate by email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@company.com"
            className="input w-full mt-1"
          />
        </label>
        <select value={role} onChange={(e) => setRole(e.target.value as TeamRole)} className="input">
          {TEAM_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button disabled={busy} className="btn btn-primary">
          {busy ? "Adding…" : "Add"}
        </button>
      </form>
      {msg && <p className="text-sm text-red-600">{msg}</p>}

      {members.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No teammates yet. They must have a Nanocer account before you can add them.
        </p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id} className="border-t border-[var(--border)]">
                <td className="py-2 pr-2">{m.email ?? m.user_id}</td>
                <td className="py-2 pr-2">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value as TeamRole)}
                    className="input text-sm py-1"
                  >
                    {TEAM_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => removeMember(m)} className="text-red-400 hover:text-red-600 text-xs">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
