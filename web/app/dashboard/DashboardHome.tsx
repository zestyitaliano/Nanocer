"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LISTING_STATUSES,
  PROPERTY_TYPES,
  type Listing,
  type ListingStatus,
  type PropertyType,
  type QrCode,
} from "@/lib/types";
import ListingCard from "@/components/ListingCard";
import BrandMark from "@/components/BrandMark";

type StatusFilter = "all" | ListingStatus;

// Dot colour per status for the sidebar nav.
const STATUS_DOT: Record<StatusFilter, string> = {
  all: "bg-orange-500",
  other: "bg-neutral-300",
  active: "bg-emerald-500",
  leased_up: "bg-rose-400",
};

export default function DashboardHome({
  initialListings,
  initialCodes,
  initialLeads,
  userId,
  userEmail,
}: {
  initialListings: Listing[];
  initialCodes: Pick<QrCode, "id" | "listing_id" | "scan_count">[];
  initialLeads: { listing_id: string }[];
  userId: string;
  userEmail: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [listings] = useState<Listing[]>(initialListings);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const perListing = useMemo(() => {
    const codes: Record<string, number> = {};
    const scans: Record<string, number> = {};
    for (const c of initialCodes) {
      if (!c.listing_id) continue;
      codes[c.listing_id] = (codes[c.listing_id] ?? 0) + 1;
      scans[c.listing_id] = (scans[c.listing_id] ?? 0) + (c.scan_count ?? 0);
    }
    return { codes, scans };
  }, [initialCodes]);

  const totals = useMemo(() => {
    let codes = 0,
      scans = 0;
    for (const c of initialCodes) {
      codes += 1;
      scans += c.scan_count ?? 0;
    }
    return { properties: listings.length, codes, scans, leads: initialLeads.length };
  }, [initialCodes, initialLeads, listings.length]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = { all: listings.length };
    for (const l of listings) m[l.status] = (m[l.status] ?? 0) + 1;
    return m;
  }, [listings]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [listings, status, search]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = (userEmail?.[0] ?? "U").toUpperCase();
  const heading =
    status === "all"
      ? "All properties"
      : LISTING_STATUSES.find((s) => s.value === status)?.label;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      {/* Sidebar ----------------------------------------------------- */}
      <aside className="hidden md:flex flex-col gap-6 p-5 border-r border-[var(--border)] bg-white/60 backdrop-blur">
        <div className="flex items-center gap-2.5 px-1">
          <div className="brand-gradient w-9 h-9 rounded grid place-items-center text-white">
            <BrandMark className="w-4 h-4" />
          </div>
          <span className="font-display font-semibold text-lg tracking-tight">Nanocer</span>
        </div>

        <nav className="space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
            Properties
          </p>
          <SidebarItem label="All properties" dot={STATUS_DOT.all} count={statusCounts.all ?? 0} active={status === "all"} onClick={() => setStatus("all")} />
          {LISTING_STATUSES.map((s) => (
            <SidebarItem key={s.value} label={s.label} dot={STATUS_DOT[s.value]} count={statusCounts[s.value] ?? 0} active={status === s.value} onClick={() => setStatus(s.value)} />
          ))}
        </nav>

        <div className="mt-auto card p-3 flex items-center gap-3">
          <div className="brand-gradient w-9 h-9 rounded-full grid place-items-center text-white text-sm font-semibold shrink-0">{initial}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{userEmail}</p>
            <button onClick={signOut} className="text-xs brand-text font-medium">Sign out</button>
          </div>
        </div>
      </aside>

      {/* Main -------------------------------------------------------- */}
      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <span className="md:hidden brand-gradient w-9 h-9 rounded grid place-items-center text-white shrink-0">
            <BrandMark className="w-4 h-4" />
          </span>
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="9" cy="9" r="6" />
              <path d="m17 17-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search properties…" className="input w-full pl-9" />
          </div>
          <button onClick={() => setModal(true)} className="btn btn-primary ml-auto">
            <span className="text-base leading-none">+</span> New Property
          </button>
          <button onClick={signOut} className="md:hidden btn btn-secondary btn-sm">Sign out</button>
        </div>

        <section className="brand-gradient relative overflow-hidden rounded-lg px-6 sm:px-8 py-7 text-white">
          <div aria-hidden className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/10" />
          <div aria-hidden className="absolute right-16 bottom-[-3rem] w-40 h-40 rounded-full bg-white/10" />
          <div className="relative max-w-lg space-y-3">
            <p className="text-sm/relaxed text-white/80 font-medium">Your own owned ILS</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Turn every sign &amp; flyer into a tracked lead source.</h1>
            <p className="text-white/85 text-sm max-w-md">Restyle and re-point QR codes anytime, host property pages, and watch the scans roll in — no reprinting.</p>
            <button onClick={() => setModal(true)} className="btn bg-[#1a1924] text-white hover:bg-black mt-1">+ New Property</button>
          </div>
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Properties" value={totals.properties} icon="🏠" />
          <StatCard label="QR codes" value={totals.codes} icon="▣" />
          <StatCard label="Total scans" value={totals.scans} icon="📈" />
          <StatCard label="Leads" value={totals.leads} icon="✉️" />
        </div>

        <section>
          <h2 className="text-sm font-semibold text-[var(--muted)] mb-3 px-1">
            {heading}
            <span className="ml-1.5 text-[var(--muted)]/70">({visible.length})</span>
          </h2>
          {visible.length === 0 ? (
            <div className="card text-center text-[var(--muted)] text-sm py-20 px-4">
              No properties here yet. Click{" "}
              <span className="font-medium text-[var(--ink)]">+ New Property</span> to add one.
            </div>
          ) : (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
              {visible.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  codeCount={perListing.codes[l.id] ?? 0}
                  scanSum={perListing.scans[l.id] ?? 0}
                  onOpen={() => router.push(`/dashboard/listing/${l.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {modal && (
        <NewPropertyModal
          busy={busy}
          onClose={() => setModal(false)}
          onCreate={async (fields) => {
            setBusy(true);
            const { property_type, ...cols } = fields;
            const { data, error } = await supabase
              .from("listings")
              .insert({ user_id: userId, name: "", ...cols, page_config: { property_type } })
              .select()
              .single();
            setBusy(false);
            if (error) return alert(error.message);
            router.push(`/dashboard/listing/${(data as Listing).id}`);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="card p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div className="w-11 h-11 rounded grid place-items-center text-lg bg-orange-50 shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="font-display text-xl sm:text-2xl font-bold tracking-tight leading-none">{value.toLocaleString()}</div>
        <div className="text-xs text-[var(--muted)] mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function SidebarItem({ label, dot, count, active, onClick }: { label: string; dot: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2.5 transition ${
        active ? "bg-orange-50 text-orange-700 font-medium" : "text-[var(--ink)] hover:bg-neutral-100"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="truncate flex-1">{label}</span>
      <span className={`text-[11px] ${active ? "text-orange-500" : "text-[var(--muted)]"}`}>{count}</span>
    </button>
  );
}

function NewPropertyModal({
  busy,
  onClose,
  onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (fields: {
    address: string;
    status: ListingStatus;
    property_type: PropertyType;
    price: number | null;
    beds: number | null;
    baths: number | null;
  }) => void;
}) {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ListingStatus>("other");
  const [propertyType, setPropertyType] = useState<PropertyType>("multifamily");
  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const isSingleHome = propertyType === "single_family";

  return (
    <div className="fixed inset-0 bg-[#1a1924]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold text-lg tracking-tight">New Property</h2>
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Address / name</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Springfield" className="input w-full mt-1" autoFocus />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Property type</span>
          <select value={propertyType} onChange={(e) => setPropertyType(e.target.value as PropertyType)} className="input w-full mt-1">
            {PROPERTY_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as ListingStatus)} className="input w-full mt-1">
            {LISTING_STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
        </label>

        {isSingleHome ? (
          <div className="grid grid-cols-3 gap-2">
            <label className="block"><span className="text-xs text-[var(--muted)]">Price</span><input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className="input w-full mt-1" /></label>
            <label className="block"><span className="text-xs text-[var(--muted)]">Beds</span><input value={beds} onChange={(e) => setBeds(e.target.value)} inputMode="numeric" className="input w-full mt-1" /></label>
            <label className="block"><span className="text-xs text-[var(--muted)]">Baths</span><input value={baths} onChange={(e) => setBaths(e.target.value)} inputMode="numeric" className="input w-full mt-1" /></label>
          </div>
        ) : (
          <p className="text-xs text-[var(--muted)] bg-orange-50 rounded-lg px-3 py-2">
            Add floor plans (units) with their own beds/baths/pricing after creating — in the property&apos;s <span className="font-medium">Page</span> tab.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button
            onClick={() => onCreate({ address: address.trim(), status, property_type: propertyType, price: isSingleHome ? num(price) : null, beds: isSingleHome ? num(beds) : null, baths: isSingleHome ? num(baths) : null })}
            disabled={busy || !address.trim()}
            className="btn btn-primary"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
