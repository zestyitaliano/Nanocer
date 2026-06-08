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

type StatusFilter = "all" | ListingStatus;

// Dot colour per status — used in the sidebar filters so the nav reads like
// the reference's icon list, but stays meaningful to the data.
const STATUS_DOT: Record<StatusFilter, string> = {
  all: "bg-violet-500",
  coming_soon: "bg-amber-400",
  active: "bg-emerald-500",
  leased_up: "bg-neutral-400",
  other: "bg-neutral-300",
};

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

  const totals = useMemo(() => {
    let codes = 0;
    let scans = 0;
    for (const c of initialCodes) {
      codes += 1;
      scans += c.scan_count ?? 0;
    }
    return { listings: listings.length, codes, scans };
  }, [initialCodes, listings.length]);

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

  const initial = (userEmail?.[0] ?? "U").toUpperCase();

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
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
            Listings
          </p>
          <SidebarItem
            label="All listings"
            dot={STATUS_DOT.all}
            count={statusCounts.all ?? 0}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          {LISTING_STATUSES.map((s) => (
            <SidebarItem
              key={s.value}
              label={s.label}
              dot={STATUS_DOT[s.value]}
              count={statusCounts[s.value] ?? 0}
              active={filter === s.value}
              onClick={() => setFilter(s.value)}
            />
          ))}
        </nav>

        <div className="mt-auto card p-3 flex items-center gap-3">
          <div className="brand-gradient w-9 h-9 rounded-full grid place-items-center text-white text-sm font-semibold shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{userEmail}</p>
            <button
              onClick={signOut}
              className="text-xs brand-text font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main -------------------------------------------------------- */}
      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl w-full mx-auto">
        {/* top bar */}
        <div className="flex items-center gap-3">
          <span className="md:hidden brand-gradient w-9 h-9 rounded-2xl grid place-items-center text-white font-bold shrink-0">
            N
          </span>
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="m17 17-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listings…"
              className="input w-full pl-9"
            />
          </div>
          <button
            onClick={() => setModal(true)}
            className="btn btn-primary ml-auto"
          >
            <span className="text-base leading-none">+</span> New Listing
          </button>
          <button onClick={signOut} className="md:hidden btn btn-secondary btn-sm">
            Sign out
          </button>
        </div>

        {/* gradient hero */}
        <section className="brand-gradient relative overflow-hidden rounded-3xl px-6 sm:px-8 py-7 text-white shadow-[0_12px_36px_rgba(99,72,235,0.32)]">
          <div
            aria-hidden
            className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/10"
          />
          <div
            aria-hidden
            className="absolute right-16 bottom-[-3rem] w-40 h-40 rounded-full bg-white/10"
          />
          <div className="relative max-w-lg space-y-3">
            <p className="text-sm/relaxed text-white/80 font-medium">
              Your own owned ILS
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Turn every sign &amp; flyer into a tracked lead source.
            </h1>
            <p className="text-white/85 text-sm max-w-md">
              Restyle and re-point QR codes anytime, host property pages, and
              watch the scans roll in — no reprinting.
            </p>
            <button
              onClick={() => setModal(true)}
              className="btn bg-[#1a1924] text-white hover:bg-black mt-1"
            >
              + New Listing
            </button>
          </div>
        </section>

        {/* stat cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard label="Listings" value={totals.listings} icon="🏠" />
          <StatCard label="QR codes" value={totals.codes} icon="▣" />
          <StatCard label="Total scans" value={totals.scans} icon="📈" />
        </div>

        {/* mobile filter chips */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <FilterChip
            label="All"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          {LISTING_STATUSES.map((s) => (
            <FilterChip
              key={s.value}
              label={s.label}
              active={filter === s.value}
              onClick={() => setFilter(s.value)}
            />
          ))}
        </div>

        {/* listings */}
        <section>
          <h2 className="text-sm font-semibold text-[var(--muted)] mb-3 px-1">
            {filter === "all"
              ? "All listings"
              : LISTING_STATUSES.find((s) => s.value === filter)?.label}
            <span className="ml-1.5 text-[var(--muted)]/70">
              ({visible.length})
            </span>
          </h2>
          {visible.length === 0 ? (
            <div className="card text-center text-[var(--muted)] text-sm py-20 px-4">
              No listings here yet. Click{" "}
              <span className="font-medium text-[var(--ink)]">+ New Listing</span>{" "}
              to add one.
            </div>
          ) : (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
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
      </main>

      {modal && (
        <NewListingModal
          busy={busy}
          onClose={() => setModal(false)}
          onCreate={async (fields) => {
            setBusy(true);
            const { property_type, ...cols } = fields;
            const { data, error } = await supabase
              .from("listings")
              .insert({
                user_id: userId,
                name: "",
                ...cols,
                // property_type lives in page_config (no column).
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

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="card p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div className="w-11 h-11 rounded-2xl grid place-items-center text-lg bg-violet-50 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-display text-xl sm:text-2xl font-bold tracking-tight leading-none">
          {value.toLocaleString()}
        </div>
        <div className="text-xs text-[var(--muted)] mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function SidebarItem({
  label,
  dot,
  count,
  active,
  onClick,
}: {
  label: string;
  dot: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2.5 transition ${
        active
          ? "bg-violet-50 text-violet-700 font-medium"
          : "text-[var(--ink)] hover:bg-neutral-100"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="truncate flex-1">{label}</span>
      <span
        className={`text-[11px] ${active ? "text-violet-500" : "text-[var(--muted)]"}`}
      >
        {count}
      </span>
    </button>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`chip border whitespace-nowrap ${
        active
          ? "brand-gradient text-white border-transparent"
          : "bg-white text-[var(--muted)] border-[var(--border)]"
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
  const [status, setStatus] = useState<ListingStatus>("coming_soon");
  const [propertyType, setPropertyType] = useState<PropertyType>("multifamily");
  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  // Communities carry their numbers on each floor plan, not the listing.
  const isSingleHome = propertyType === "single_family";

  return (
    <div
      className="fixed inset-0 bg-[#1a1924]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="card p-6 w-full max-w-md space-y-4 shadow-[var(--shadow-md)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg tracking-tight">New Listing</h2>
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Address / name</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, Springfield"
            className="input w-full mt-1"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Property type</span>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value as PropertyType)}
            className="input w-full mt-1"
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ListingStatus)}
            className="input w-full mt-1"
          >
            {LISTING_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {isSingleHome ? (
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Price</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className="input w-full mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Beds</span>
              <input value={beds} onChange={(e) => setBeds(e.target.value)} inputMode="numeric" className="input w-full mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Baths</span>
              <input value={baths} onChange={(e) => setBaths(e.target.value)} inputMode="numeric" className="input w-full mt-1" />
            </label>
          </div>
        ) : (
          <p className="text-xs text-[var(--muted)] bg-violet-50 rounded-lg px-3 py-2">
            Add floor plans (units) with their own beds/baths/pricing after
            creating — in the listing&apos;s <span className="font-medium">Page</span> tab.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={() =>
              onCreate({
                address: address.trim(),
                status,
                property_type: propertyType,
                price: isSingleHome ? num(price) : null,
                beds: isSingleHome ? num(beds) : null,
                baths: isSingleHome ? num(baths) : null,
              })
            }
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
