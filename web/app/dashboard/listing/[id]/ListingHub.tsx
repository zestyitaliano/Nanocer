"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { newShortCode } from "@/lib/shortcode";
import {
  DEFAULT_STYLE,
  LISTING_STATUSES,
  encodedValue,
  type Listing,
  type ListingStatus,
  type QrCode,
} from "@/lib/types";
import { siteUrl } from "@/lib/api";
import { STATUS_COLOR } from "@/components/ListingCard";
import QrThumb from "@/components/QrThumb";
import PageTab from "./PageTab";
import LeadsTab from "./LeadsTab";

type Tab = "overview" | "codes" | "page" | "leads" | "analytics";

export default function ListingHub({
  listing: initial,
  initialCodes,
  userId,
}: {
  listing: Listing;
  initialCodes: QrCode[];
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
    <main className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => {
            router.push("/dashboard");
            router.refresh();
          }}
          className="text-blue-600 text-sm font-medium"
        >
          ← Listings
        </button>
        <span className="text-neutral-300">/</span>
        <span className="text-sm font-medium truncate">{label}</span>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={listing.status}
            onChange={(e) => setStatus(e.target.value as ListingStatus)}
            className={`text-xs rounded px-2 py-1 border ${STATUS_COLOR[listing.status]}`}
          >
            {LISTING_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button onClick={deleteListing} className="text-sm text-red-600">
            Delete
          </button>
        </div>
      </header>

      <div className="border-b bg-white px-4">
        <nav className="flex gap-1 text-sm">
          {(["overview", "codes", "page", "leads", "analytics"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 capitalize border-b-2 -mb-px ${
                tab === t
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {t}
              {t === "codes" ? ` (${codes.length})` : ""}
            </button>
          ))}
        </nav>
      </div>

      <div className="max-w-4xl mx-auto p-5">
        {tab === "overview" && (
          <div className="bg-white border rounded-xl p-5 space-y-3 max-w-xl">
            <label className="block">
              <span className="text-xs text-neutral-500">Address / name</span>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["price", "beds", "baths", "sqft"] as const).map((k) => (
                <label key={k} className="block">
                  <span className="text-xs text-neutral-500 capitalize">{k}</span>
                  <input
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    inputMode="numeric"
                    className="w-full border rounded-lg px-2 py-2 text-sm"
                  />
                </label>
              ))}
            </div>
            <label className="block">
              <span className="text-xs text-neutral-500">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <button
              onClick={saveDetails}
              disabled={busy}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save details"}
            </button>
          </div>
        )}

        {tab === "codes" && (
          <div>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => addCode(true)}
                disabled={busy}
                className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm"
              >
                + Dynamic code
              </button>
              <button
                onClick={() => addCode(false)}
                disabled={busy}
                className="border rounded-lg px-3 py-1.5 text-sm"
              >
                + Static code
              </button>
            </div>
            {codes.length === 0 ? (
              <div className="text-center text-neutral-400 text-sm py-16 border rounded-xl bg-white">
                No codes yet for this listing.
              </div>
            ) : (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
                {codes.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/dashboard/${c.id}`)}
                    className="bg-white border rounded-xl p-3 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex justify-center">
                      <QrThumb value={encodedValue(c, siteUrl())} style={c.style} size={120} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {c.title || "(untitled)"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCode(c);
                        }}
                        className="text-red-500 text-xs shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-[11px] text-neutral-400">
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
            onSaved={(patch) => setListing((l) => ({ ...l, ...patch }))}
          />
        )}

        {tab === "leads" && <LeadsTab listingId={listing.id} />}

        {tab === "analytics" && (
          <div className="text-center text-neutral-400 text-sm py-16 border rounded-xl bg-white">
            Per-listing analytics — coming soon.
          </div>
        )}
      </div>
    </main>
  );
}
