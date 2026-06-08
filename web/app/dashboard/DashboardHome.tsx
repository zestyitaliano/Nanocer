"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LISTING_STATUSES,
  type Listing,
  type ListingStatus,
  type QrCode,
} from "@/lib/types";
import ListingCard from "@/components/ListingCard";

type StatusFilter = "all" | ListingStatus;

export default function DashboardHome({
  initialListings,
  initialCodes,
  userId,
  userEmail,
}: {
  initialListings: Listing[];
  initialCodes: Pick<QrCode, "id" | "listing_id" | "scan_count">[];
  userId: string;
  userEmail: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [listings] = useState<Listing[]>(initialListings);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);

  // per-listing rollups from codes
  const rollup = useMemo(() => {
    const codes: Record<string, number> = {};
    const scans: Record<string, number> = {};
    for (const c of initialCodes) {
      if (!c.listing_id) continue;
      codes[c.listing_id] = (codes[c.listing_id] ?? 0) + 1;
      scans[c.listing_id] = (scans[c.listing_id] ?? 0) + (c.scan_count ?? 0);
    }
    return { codes, scans };
  }, [initialCodes]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = { all: listings.length };
    for (const l of listings) m[l.status] = (m[l.status] ?? 0) + 1;
    return m;
  }, [listings]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [listings, filter, search]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <h1 className="font-semibold text-lg">Nanocer</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search listings…"
          className="ml-2 flex-1 max-w-md border rounded-lg px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => setModal(true)}
          className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium"
        >
          + New Listing
        </button>
        <span className="text-neutral-500 text-sm ml-2 hidden sm:inline">
          {userEmail}
        </span>
        <button onClick={signOut} className="text-blue-600 text-sm">
          Sign out
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 p-4">
        <aside className="space-y-1">
          <SidebarItem
            label="All listings"
            count={statusCounts.all ?? 0}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          {LISTING_STATUSES.map((s) => (
            <SidebarItem
              key={s.value}
              label={s.label}
              count={statusCounts[s.value] ?? 0}
              active={filter === s.value}
              onClick={() => setFilter(s.value)}
            />
          ))}
        </aside>

        <section>
          {visible.length === 0 ? (
            <div className="text-center text-neutral-400 text-sm py-20 border rounded-xl bg-white">
              No listings here yet. Click{" "}
              <span className="font-medium">+ New Listing</span> to add one.
            </div>
          ) : (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
              {visible.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  codeCount={rollup.codes[l.id] ?? 0}
                  scanSum={rollup.scans[l.id] ?? 0}
                  onOpen={() => router.push(`/dashboard/listing/${l.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {modal && (
        <NewListingModal
          busy={busy}
          onClose={() => setModal(false)}
          onCreate={async (fields) => {
            setBusy(true);
            const { data, error } = await supabase
              .from("listings")
              .insert({ user_id: userId, name: "", ...fields })
              .select()
              .single();
            setBusy(false);
            if (error) return alert(error.message);
            router.push(`/dashboard/listing/${(data as Listing).id}`);
          }}
        />
      )}
    </main>
  );
}

function SidebarItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm flex justify-between items-center ${
        active ? "bg-blue-50 text-blue-700" : "hover:bg-neutral-100"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-neutral-400">{count}</span>
    </button>
  );
}

function NewListingModal({
  busy,
  onClose,
  onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (fields: {
    address: string;
    status: ListingStatus;
    price: number | null;
    beds: number | null;
    baths: number | null;
  }) => void;
}) {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ListingStatus>("coming_soon");
  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-5 w-full max-w-md space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg">New Listing</h2>
        <label className="block">
          <span className="text-xs text-neutral-500">Address / name</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, Springfield"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-500">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ListingStatus)}
            className="w-full border rounded-lg px-2 py-2 text-sm"
          >
            {LISTING_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-xs text-neutral-500">Price</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className="w-full border rounded-lg px-2 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Beds</span>
            <input value={beds} onChange={(e) => setBeds(e.target.value)} inputMode="numeric" className="w-full border rounded-lg px-2 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Baths</span>
            <input value={baths} onChange={(e) => setBaths(e.target.value)} inputMode="numeric" className="w-full border rounded-lg px-2 py-2 text-sm" />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={() =>
              onCreate({ address: address.trim(), status, price: num(price), beds: num(beds), baths: num(baths) })
            }
            disabled={busy || !address.trim()}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
