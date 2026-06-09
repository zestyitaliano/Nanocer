"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { newShortCode } from "@/lib/shortcode";
import {
  DEFAULT_STYLE,
  LISTING_STATUSES,
  encodedValue,
  type FloorPlan,
  type Listing,
  type ListingStatus,
  type QrCode,
} from "@/lib/types";
import { siteUrl } from "@/lib/api";
import { statusColor } from "@/components/ListingCard";
import QrThumb from "@/components/QrThumb";
import PageTab from "./PageTab";
import LeadsTab from "./LeadsTab";
import TeamTab from "./TeamTab";
import ListingAnalytics from "./ListingAnalytics";

type Tab = "overview" | "codes" | "page" | "leads" | "team" | "analytics";

export default function ListingHub({
  listing: initial,
  initialCodes,
  initialFloorPlans,
  userId,
}: {
  listing: Listing;
  initialCodes: QrCode[];
  initialFloorPlans: FloorPlan[];
  userId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [listing, setListing] = useState<Listing>(initial);
  const [codes, setCodes] = useState<QrCode[]>(initialCodes);
  const [busy, setBusy] = useState(false);

  // editable overview fields
  const [form, setForm] = useState({
    address: initial.address ?? "",
    price: initial.price?.toString() ?? "",
    beds: initial.beds?.toString() ?? "",
    baths: initial.baths?.toString() ?? "",
    sqft: initial.sqft?.toString() ?? "",
    description: initial.description ?? "",
  });
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  async function setStatus(status: ListingStatus) {
    setListing((l) => ({ ...l, status }));
    await supabase.from("listings").update({ status }).eq("id", listing.id);
  }

  async function saveDetails() {
    setBusy(true);
    const patch = {
      address: form.address.trim() || null,
      price: num(form.price),
      beds: num(form.beds),
      baths: num(form.baths),
      sqft: num(form.sqft),
      description: form.description.trim() || null,
    };
    const { error } = await supabase.from("listings").update(patch).eq("id", listing.id);
    setBusy(false);
    if (error) return alert(error.message);
    setListing((l) => ({ ...l, ...patch }));
    router.refresh();
  }

  async function deleteListing() {
    if (
      !window.confirm(
        "Delete this listing? Its codes are kept but become unassigned (General).",
      )
    )
      return;
    const { error } = await supabase.from("listings").delete().eq("id", listing.id);
    if (error) return alert(error.message);
    router.push("/dashboard");
    router.refresh();
  }

  async function addCode(isDynamic: boolean) {
    setBusy(true);
    try {
      for (let i = 0; i < 5; i++) {
        const short_code = newShortCode();
        const { data, error } = await supabase
          .from("codes")
          .insert({
            user_id: userId,
            short_code,
            title: isDynamic ? "New dynamic code" : "New static code",
            is_dynamic: isDynamic,
            destination: "",
            content: isDynamic ? "" : "https://example.com",
            style: DEFAULT_STYLE,
            listing_id: listing.id,
            // Point at the property page by default once it's published.
            target_mode: isDynamic && listing.page_enabled ? "listing_page" : "url",
          })
          .select()
          .single();
        if (!error) {
          router.push(`/dashboard/${(data as QrCode).id}`);
          return;
        }
        if (error.code !== "23505") {
          alert(error.message);
          return;
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteCode(code: QrCode) {
    if (!window.confirm(`Delete “${code.title || code.short_code}”?`)) return;
    const { error } = await supabase.from("codes").delete().eq("id", code.id);
    if (error) return alert(error.message);
    setCodes((cs) => cs.filter((c) => c.id !== code.id));
  }

  const label = listing.name || listing.address || "(untitled)";

  return (
    <main className="min-h-screen">
      <header className="bg-white/70 backdrop-blur border-b border-[var(--border)] px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button
          onClick={() => {
            router.push("/dashboard");
            router.refresh();
          }}
          className="btn btn-secondary btn-sm"
        >
          ← Properties
        </button>
        <span className="text-sm font-semibold truncate">{label}</span>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={listing.status}
            onChange={(e) => setStatus(e.target.value as ListingStatus)}
            className={`chip border-0 cursor-pointer ${statusColor(listing.status)}`}
          >
            {LISTING_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button onClick={deleteListing} className="btn btn-danger btn-sm">
            Delete
          </button>
        </div>
      </header>

      <div className="bg-white/70 backdrop-blur border-b border-[var(--border)] px-4 sm:px-6">
        <nav className="flex gap-1 text-sm max-w-4xl mx-auto overflow-x-auto py-2">
          {(["overview", "codes", "page", "leads", "team", "analytics"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded capitalize whitespace-nowrap transition ${
                tab === t
                  ? "brand-gradient text-white"
                  : "text-[var(--muted)] hover:bg-neutral-100"
              }`}
            >
              {t}
              {t === "codes" ? ` (${codes.length})` : ""}
            </button>
          ))}
        </nav>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {tab === "overview" && (
          <div className="card p-6 space-y-4 max-w-xl">
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Address / name</span>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input w-full mt-1"
              />
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["price", "beds", "baths", "sqft"] as const).map((k) => (
                <label key={k} className="block">
                  <span className="text-xs text-[var(--muted)] capitalize">{k}</span>
                  <input
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    inputMode="numeric"
                    className="input w-full mt-1"
                  />
                </label>
              ))}
            </div>
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="input w-full mt-1"
              />
            </label>
            <button onClick={saveDetails} disabled={busy} className="btn btn-primary">
              {busy ? "Saving…" : "Save details"}
            </button>
          </div>
        )}

        {tab === "codes" && (
          <div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => addCode(true)}
                disabled={busy}
                className="btn btn-primary btn-sm"
              >
                + Dynamic code
              </button>
              <button
                onClick={() => addCode(false)}
                disabled={busy}
                className="btn btn-secondary btn-sm"
              >
                + Static code
              </button>
            </div>
            {codes.length === 0 ? (
              <div className="card text-center text-[var(--muted)] text-sm py-16">
                No codes yet for this listing.
              </div>
            ) : (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
                {codes.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/dashboard/${c.id}`)}
                    className="card card-hover p-4 cursor-pointer"
                  >
                    <div className="flex justify-center">
                      <QrThumb value={encodedValue(c, siteUrl())} style={c.style} size={120} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {c.title || "(untitled)"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCode(c);
                        }}
                        className="text-red-400 hover:text-red-600 text-xs shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5">
                      {c.is_dynamic ? `${c.scan_count} scans` : "static"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "page" && (
          <PageTab
            listing={listing}
            userId={userId}
            initialPlans={initialFloorPlans}
            onSaved={(patch) => setListing((l) => ({ ...l, ...patch }))}
          />
        )}

        {tab === "leads" && <LeadsTab listingId={listing.id} />}

        {tab === "team" && <TeamTab listingId={listing.id} userId={userId} />}

        {tab === "analytics" && (
          <ListingAnalytics
            listingId={listing.id}
            codes={codes}
            plans={initialFloorPlans}
          />
        )}
      </div>
    </main>
  );
}
