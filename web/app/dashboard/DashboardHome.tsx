"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LISTING_STATUSES,
  PROPERTY_TYPES,
  type Listing,
  type ListingStatus,
  type Portfolio,
  type PropertyType,
  type QrCode,
} from "@/lib/types";
import ListingCard from "@/components/ListingCard";

type StatusFilter = "all" | ListingStatus;
type PortfolioFilter = "all" | "unassigned" | string;

export default function DashboardHome({
  initialListings,
  initialCodes,
  initialLeads,
  initialPortfolios,
  userId,
  userEmail,
}: {
  initialListings: Listing[];
  initialCodes: Pick<QrCode, "id" | "listing_id" | "scan_count">[];
  initialLeads: { listing_id: string }[];
  initialPortfolios: Portfolio[];
  userId: string;
  userEmail: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [portfolios, setPortfolios] = useState<Portfolio[]>(initialPortfolios);
  const [portfolioFilter, setPortfolioFilter] = useState<PortfolioFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  // per-listing rollups
  const perListing = useMemo(() => {
    const codes: Record<string, number> = {};
    const scans: Record<string, number> = {};
    const leads: Record<string, number> = {};
    for (const c of initialCodes) {
      if (!c.listing_id) continue;
      codes[c.listing_id] = (codes[c.listing_id] ?? 0) + 1;
      scans[c.listing_id] = (scans[c.listing_id] ?? 0) + (c.scan_count ?? 0);
    }
    for (const l of initialLeads) {
      if (l.listing_id) leads[l.listing_id] = (leads[l.listing_id] ?? 0) + 1;
    }
    return { codes, scans, leads };
  }, [initialCodes, initialLeads]);

  const portfolioCounts = useMemo(() => {
    const m: Record<string, number> = { all: listings.length, unassigned: 0 };
    for (const l of listings) {
      if (l.portfolio_id) m[l.portfolio_id] = (m[l.portfolio_id] ?? 0) + 1;
      else m.unassigned += 1;
    }
    return m;
  }, [listings]);

  const inPortfolio = (l: Listing) =>
    portfolioFilter === "all"
      ? true
      : portfolioFilter === "unassigned"
        ? !l.portfolio_id
        : l.portfolio_id === portfolioFilter;

  // Stat cards reflect the selected portfolio scope (ignoring status/search).
  const scope = useMemo(() => {
    const ls = listings.filter(inPortfolio);
    let codes = 0,
      scans = 0,
      leads = 0;
    for (const l of ls) {
      codes += perListing.codes[l.id] ?? 0;
      scans += perListing.scans[l.id] ?? 0;
      leads += perListing.leads[l.id] ?? 0;
    }
    return { listings: ls.length, codes, scans, leads };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, perListing, portfolioFilter]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((l) => {
      if (!inPortfolio(l)) return false;
      if (status !== "all" && l.status !== status) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.address ?? "").toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, portfolioFilter, status, search]);

  // --- portfolio CRUD ------------------------------------------------------
  async function createPortfolio() {
    const name = window.prompt("New portfolio name:")?.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("portfolios")
      .insert({ user_id: userId, name })
      .select()
      .single();
    if (error) return alert(error.message);
    setPortfolios((p) => [...p, data as Portfolio].sort((a, b) => a.name.localeCompare(b.name)));
  }
  async function renamePortfolio(id: string, current: string) {
    const name = window.prompt("Rename portfolio:", current)?.trim();
    if (!name) return;
    const { error } = await supabase.from("portfolios").update({ name }).eq("id", id);
    if (error) return alert(error.message);
    setPortfolios((p) =>
      p.map((x) => (x.id === id ? { ...x, name } : x)).sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
  async function deletePortfolio(id: string) {
    if (!window.confirm("Delete this portfolio? Its listings become Unassigned."))
      return;
    const { error } = await supabase.from("portfolios").delete().eq("id", id);
    if (error) return alert(error.message);
    setPortfolios((p) => p.filter((x) => x.id !== id));
    setListings((ls) =>
      ls.map((l) => (l.portfolio_id === id ? { ...l, portfolio_id: null } : l)),
    );
    if (portfolioFilter === id) setPortfolioFilter("all");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = (userEmail?.[0] ?? "U").toUpperCase();
  const heading =
    portfolioFilter === "all"
      ? "All listings"
      : portfolioFilter === "unassigned"
        ? "Unassigned"
        : portfolios.find((p) => p.id === portfolioFilter)?.name ?? "Portfolio";

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      {/* Sidebar ----------------------------------------------------- */}
      <aside className="hidden md:flex flex-col gap-6 p-5 border-r border-[var(--border)] bg-white/60 backdrop-blur">
        <div className="flex items-center gap-2.5 px-1">
          <div className="brand-gradient w-9 h-9 rounded-2xl grid place-items-center text-white font-bold shadow-sm">
            N
          </div>
          <span className="font-display font-semibold text-lg tracking-tight">Nanocer</span>
        </div>

        <nav className="space-y-1">
          <div className="px-3 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Portfolios
            </span>
            <button onClick={createPortfolio} className="brand-text text-sm font-medium" aria-label="New portfolio">
              +
            </button>
          </div>
          <SidebarItem label="All listings" dot="bg-violet-500" count={portfolioCounts.all ?? 0} active={portfolioFilter === "all"} onClick={() => setPortfolioFilter("all")} />
          <SidebarItem label="Unassigned" dot="bg-neutral-300" count={portfolioCounts.unassigned ?? 0} active={portfolioFilter === "unassigned"} onClick={() => setPortfolioFilter("unassigned")} />
          {portfolios.map((p) => (
            <div key={p.id} className="relative flex items-center">
              <SidebarItem label={p.name || "(untitled)"} dot="bg-indigo-400" count={portfolioCounts[p.id] ?? 0} active={portfolioFilter === p.id} onClick={() => setPortfolioFilter(p.id)} />
              <button onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} className="absolute right-1 px-1 text-[var(--muted)] hover:text-[var(--ink)]" aria-label="portfolio actions">
                ⋯
              </button>
              {menuFor === p.id && (
                <div className="absolute right-0 top-9 z-10 w-32 card shadow-[var(--shadow-md)] text-sm py-1">
                  <button onClick={() => { setMenuFor(null); renamePortfolio(p.id, p.name); }} className="block w-full text-left px-3 py-1.5 hover:bg-neutral-50">Rename</button>
                  <button onClick={() => { setMenuFor(null); deletePortfolio(p.id); }} className="block w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600">Delete</button>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="mt-auto card p-3 flex items-center gap-3">
          <div className="brand-gradient w-9 h-9 rounded-full grid place-items-center text-white text-sm font-semibold shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{userEmail}</p>
            <button onClick={signOut} className="text-xs brand-text font-medium">Sign out</button>
          </div>
        </div>
      </aside>

      {/* Main -------------------------------------------------------- */}
      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <span className="md:hidden brand-gradient w-9 h-9 rounded-2xl grid place-items-center text-white font-bold shrink-0">N</span>
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="9" cy="9" r="6" />
              <path d="m17 17-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search listings…" className="input w-full pl-9" />
          </div>
          <button onClick={() => setModal(true)} className="btn btn-primary ml-auto">
            <span className="text-base leading-none">+</span> New Listing
          </button>
          <button onClick={signOut} className="md:hidden btn btn-secondary btn-sm">Sign out</button>
        </div>

        <section className="brand-gradient relative overflow-hidden rounded-3xl px-6 sm:px-8 py-7 text-white shadow-[0_12px_36px_rgba(99,72,235,0.32)]">
          <div aria-hidden className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/10" />
          <div aria-hidden className="absolute right-16 bottom-[-3rem] w-40 h-40 rounded-full bg-white/10" />
          <div className="relative max-w-lg space-y-3">
            <p className="text-sm/relaxed text-white/80 font-medium">Your own owned ILS</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Turn every sign &amp; flyer into a tracked lead source.</h1>
            <p className="text-white/85 text-sm max-w-md">Restyle and re-point QR codes anytime, host property pages, and watch the scans roll in — no reprinting.</p>
            <button onClick={() => setModal(true)} className="btn bg-[#1a1924] text-white hover:bg-black mt-1">+ New Listing</button>
          </div>
        </section>

        {/* stat cards (scoped to selected portfolio) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Listings" value={scope.listings} icon="🏠" />
          <StatCard label="QR codes" value={scope.codes} icon="▣" />
          <StatCard label="Total scans" value={scope.scans} icon="📈" />
          <StatCard label="Leads" value={scope.leads} icon="✉️" />
        </div>

        {portfolioFilter !== "all" && portfolioFilter !== "unassigned" && (
          <button
            onClick={() => router.push(`/dashboard/portfolio/${portfolioFilter}`)}
            className="brand-text text-sm font-medium"
          >
            View portfolio analytics →
          </button>
        )}

        {/* status filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <FilterChip label="All" active={status === "all"} onClick={() => setStatus("all")} />
          {LISTING_STATUSES.map((s) => (
            <FilterChip key={s.value} label={s.label} active={status === s.value} onClick={() => setStatus(s.value)} />
          ))}
        </div>

        <section>
          <h2 className="text-sm font-semibold text-[var(--muted)] mb-3 px-1">
            {heading}
            <span className="ml-1.5 text-[var(--muted)]/70">({visible.length})</span>
          </h2>
          {visible.length === 0 ? (
            <div className="card text-center text-[var(--muted)] text-sm py-20 px-4">
              No listings here yet. Click{" "}
              <span className="font-medium text-[var(--ink)]">+ New Listing</span> to add one.
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
        <NewListingModal
          busy={busy}
          onClose={() => setModal(false)}
          onCreate={async (fields) => {
            setBusy(true);
            const { property_type, ...cols } = fields;
            const portfolio_id =
              portfolioFilter !== "all" && portfolioFilter !== "unassigned"
                ? portfolioFilter
                : null;
            const { data, error } = await supabase
              .from("listings")
              .insert({
                user_id: userId,
                name: "",
                ...cols,
                portfolio_id,
                page_config: { property_type },
              })
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
      <div className="w-11 h-11 rounded-2xl grid place-items-center text-lg bg-violet-50 shrink-0">{icon}</div>
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
      className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2.5 transition ${
        active ? "bg-violet-50 text-violet-700 font-medium" : "text-[var(--ink)] hover:bg-neutral-100"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="truncate flex-1">{label}</span>
      <span className={`text-[11px] ${active ? "text-violet-500" : "text-[var(--muted)]"}`}>{count}</span>
    </button>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`chip border whitespace-nowrap ${
        active ? "brand-gradient text-white border-transparent" : "bg-white text-[var(--muted)] border-[var(--border)]"
      }`}
    >
      {label}
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
      <div className="card p-6 w-full max-w-md space-y-4 shadow-[var(--shadow-md)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold text-lg tracking-tight">New Listing</h2>
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
          <p className="text-xs text-[var(--muted)] bg-violet-50 rounded-lg px-3 py-2">
            Add floor plans (units) with their own beds/baths/pricing after creating — in the listing&apos;s <span className="font-medium">Page</span> tab.
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
