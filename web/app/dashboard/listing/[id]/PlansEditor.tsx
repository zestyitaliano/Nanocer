"use client";

// First-class floor plans (units), backed by the floor_plans table. Add/remove
// persist immediately; field edits persist on blur. Each plan can mint its own
// QR code (target_mode 'floor_plan') for true per-unit scan analytics.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { newShortCode } from "@/lib/shortcode";
import { transformUrl } from "@/lib/image";
import { syncedLabel } from "@/lib/listing";
import {
  DEFAULT_STYLE,
  type FloorPlan,
  type PlanAvailability,
  type QrCode,
} from "@/lib/types";

type CtaType = "none" | "text" | "link";

interface DraftPlan {
  id: string;
  name: string;
  beds: string;
  baths: string;
  sqft: string;
  price: string;
  price_max: string;
  price_unit: "unit" | "bed";
  availability: PlanAvailability;
  available_text: string;
  photos: string[];
  description: string;
  tags: string;
  ctaType: CtaType;
  ctaLabel: string;
  ctaValue: string;
  // Sync provenance (display + pin toggle). Not written by toRow, so manual
  // field edits never clobber them.
  source?: "manual" | "sync";
  sync_enabled: boolean;
  last_synced_at?: string | null;
}

const splitTags = (s: string) =>
  s.split(",").map((t) => t.trim()).filter(Boolean);
const num = (s: string) => (s.trim() === "" ? null : Number(s));

function toDraft(p: FloorPlan): DraftPlan {
  return {
    id: p.id,
    name: p.name ?? "",
    beds: p.beds?.toString() ?? "",
    baths: p.baths?.toString() ?? "",
    sqft: p.sqft?.toString() ?? "",
    price: p.price?.toString() ?? "",
    price_max: p.price_max?.toString() ?? "",
    price_unit: p.price_unit ?? "unit",
    availability: p.availability ?? "available",
    available_text: p.available_text ?? "",
    photos: p.photos && p.photos.length ? p.photos : p.photo_url ? [p.photo_url] : [],
    description: p.description ?? "",
    tags: (p.tags ?? []).join(", "),
    ctaType: (p.cta?.type as CtaType) ?? "none",
    ctaLabel: p.cta?.label ?? "",
    ctaValue: p.cta?.value ?? "",
    source: p.source,
    sync_enabled: p.sync_enabled ?? true,
    last_synced_at: p.last_synced_at ?? null,
  };
}

function toRow(d: DraftPlan) {
  return {
    name: d.name.trim(),
    beds: num(d.beds),
    baths: num(d.baths),
    sqft: num(d.sqft),
    price: num(d.price),
    price_max: num(d.price_max),
    price_unit: d.price_unit,
    availability: d.availability,
    available_text: d.available_text.trim() || null,
    photos: d.photos,
    photo_url: d.photos[0] ?? null,
    description: d.description.trim() || null,
    tags: splitTags(d.tags),
    cta:
      d.ctaType === "none"
        ? null
        : {
            type: d.ctaType,
            label: d.ctaLabel.trim() || undefined,
            value: d.ctaValue.trim() || undefined,
          },
  };
}

// A draft -> a FloorPlan shape for syncing the parent (quiz hints / count).
function toPlan(d: DraftPlan, listingId: string, sort: number): FloorPlan {
  const row = toRow(d);
  return {
    id: d.id,
    listing_id: listingId,
    sort_order: sort,
    ...row,
    available_text: row.available_text ?? undefined,
    photo_url: row.photo_url ?? undefined,
    description: row.description ?? undefined,
    cta: row.cta ?? undefined,
  };
}

export default function PlansEditor({
  listingId,
  userId,
  initialPlans,
  onChange,
  upload,
}: {
  listingId: string;
  userId: string;
  initialPlans: FloorPlan[];
  onChange: (plans: FloorPlan[]) => void;
  upload: (file: File) => Promise<string | null>;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [plans, setPlans] = useState<DraftPlan[]>(() => initialPlans.map(toDraft));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function sync(next: DraftPlan[]) {
    onChange(next.map((d, i) => toPlan(d, listingId, i)));
  }

  async function addPlan() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase
      .from("floor_plans")
      .insert({ listing_id: listingId, user_id: userId, name: "", sort_order: plans.length })
      .select()
      .single();
    setBusy(false);
    if (error) return setMsg(error.message);
    const next = [...plans, toDraft(data as FloorPlan)];
    setPlans(next);
    sync(next);
  }

  async function removePlan(id: string) {
    if (!window.confirm("Delete this floor plan?")) return;
    const { error } = await supabase.from("floor_plans").delete().eq("id", id);
    if (error) return setMsg(error.message);
    const next = plans.filter((p) => p.id !== id);
    setPlans(next);
    sync(next);
  }

  function patch(id: string, p: Partial<DraftPlan>) {
    setPlans((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  // Pin / unpin a synced plan: sync_enabled=false stops future syncs from
  // touching it (lets an operator keep a manual override).
  async function setPinned(id: string, pinned: boolean) {
    patch(id, { sync_enabled: !pinned });
    const { error } = await supabase
      .from("floor_plans")
      .update({ sync_enabled: !pinned })
      .eq("id", id);
    if (error) {
      patch(id, { sync_enabled: pinned });
      setMsg(error.message);
    }
  }

  // Persist one plan's fields (called on blur / after photo + select changes).
  async function persist(id: string) {
    const d = plans.find((x) => x.id === id);
    if (!d) return;
    const { error } = await supabase.from("floor_plans").update(toRow(d)).eq("id", id);
    if (error) return setMsg(error.message);
    setMsg("Saved.");
    sync(plans);
  }

  async function savePhotos(id: string, photos: string[]) {
    const next = plans.map((x) => (x.id === id ? { ...x, photos } : x));
    setPlans(next);
    await supabase
      .from("floor_plans")
      .update({ photos, photo_url: photos[0] ?? null })
      .eq("id", id);
    onChange(next.map((d, i) => toPlan(d, listingId, i)));
  }

  async function addPhotos(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    const current = plans.find((x) => x.id === id)?.photos ?? [];
    const uploaded: string[] = [];
    for (const f of files) {
      const u = await upload(f);
      if (u) uploaded.push(u);
    }
    setBusy(false);
    if (uploaded.length) await savePhotos(id, [...current, ...uploaded]);
    e.target.value = "";
  }

  async function removePhoto(id: string, i: number) {
    const current = plans.find((x) => x.id === id)?.photos ?? [];
    await savePhotos(id, current.filter((_, j) => j !== i));
  }

  async function addCodeForPlan(id: string, name: string) {
    setBusy(true);
    try {
      for (let i = 0; i < 5; i++) {
        const short_code = newShortCode();
        const { data, error } = await supabase
          .from("codes")
          .insert({
            user_id: userId,
            short_code,
            title: name ? `${name} — QR` : "Floor plan QR",
            is_dynamic: true,
            destination: "",
            content: "",
            style: DEFAULT_STYLE,
            listing_id: listingId,
            floor_plan_id: id,
            target_mode: "floor_plan",
          })
          .select()
          .single();
        if (!error) {
          router.push(`/dashboard/${(data as QrCode).id}`);
          return;
        }
        if (error.code !== "23505") {
          setMsg(error.message);
          return;
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-[var(--border)] pt-4 space-y-3">
      <div>
        <span className="text-sm font-semibold text-[var(--ink)]">Floor plans</span>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          The units in this community. Shown on the property page; each can have
          its own QR code for per-unit scan tracking. Changes save automatically.
        </p>
      </div>

      {plans.map((p, i) => (
        <div key={p.id} className="border border-[var(--border)] rounded-lg p-3 space-y-2 bg-neutral-50/70">
          {p.source === "sync" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                ⟳ {syncedLabel({ source: p.source, last_synced_at: p.last_synced_at } as FloorPlan)}
              </span>
              <label className="flex items-center gap-1 text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={!p.sync_enabled}
                  onChange={(e) => setPinned(p.id, e.target.checked)}
                  className="accent-orange-600"
                />
                Pin (stop syncing)
              </label>
              {p.sync_enabled && (
                <span className="text-[var(--muted)]">Synced fields are overwritten on next sync.</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              className="input flex-1"
              placeholder={`Plan ${i + 1} name (e.g. The Aspen — 2x2)`}
              value={p.name}
              onChange={(e) => patch(p.id, { name: e.target.value })}
              onBlur={() => persist(p.id)}
            />
            <button onClick={() => addCodeForPlan(p.id, p.name)} disabled={busy} className="text-xs brand-text font-medium shrink-0">
              + QR code
            </button>
            <button onClick={() => removePlan(p.id)} className="text-red-500 text-xs shrink-0">
              Remove
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["beds", "baths", "sqft"] as const).map((k) => (
              <input
                key={k}
                className="input"
                inputMode="numeric"
                placeholder={k}
                value={p[k]}
                onChange={(e) => patch(p.id, { [k]: e.target.value })}
                onBlur={() => persist(p.id)}
              />
            ))}
          </div>

          <div className="flex gap-2 items-center">
            <input className="input flex-1" inputMode="numeric" placeholder="Price (from)" value={p.price} onChange={(e) => patch(p.id, { price: e.target.value })} onBlur={() => persist(p.id)} />
            <span className="text-[var(--muted)] text-sm">–</span>
            <input className="input flex-1" inputMode="numeric" placeholder="Max (optional)" value={p.price_max} onChange={(e) => patch(p.id, { price_max: e.target.value })} onBlur={() => persist(p.id)} />
            <select className="input" value={p.price_unit} onChange={(e) => { patch(p.id, { price_unit: e.target.value as "unit" | "bed" }); }} onBlur={() => persist(p.id)}>
              <option value="unit">/unit</option>
              <option value="bed">/bed</option>
            </select>
          </div>

          <div className="flex gap-2 items-center">
            <select className="input" value={p.availability} onChange={(e) => patch(p.id, { availability: e.target.value as PlanAvailability })} onBlur={() => persist(p.id)}>
              <option value="available">Available</option>
              <option value="waitlist">Waitlist</option>
              <option value="unavailable">Unavailable</option>
            </select>
            <input className="input flex-1" placeholder="Availability note (e.g. Available Aug 2026)" value={p.available_text} onChange={(e) => patch(p.id, { available_text: e.target.value })} onBlur={() => persist(p.id)} />
          </div>

          <textarea className="input w-full" rows={2} placeholder="Description (optional)" value={p.description} onChange={(e) => patch(p.id, { description: e.target.value })} onBlur={() => persist(p.id)} />
          <input className="input w-full" placeholder="Match tags, comma-separated (e.g. 2bed, budget, furnished)" value={p.tags} onChange={(e) => patch(p.id, { tags: e.target.value })} onBlur={() => persist(p.id)} />

          <div>
            <span className="text-xs text-[var(--muted)]">Photos</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {p.photos.map((src, j) => (
                <div key={j} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={transformUrl(src, { width: 128 })} alt="" loading="lazy" decoding="async" className="w-14 h-14 object-cover rounded border border-[var(--border)]" />
                  <button
                    onClick={() => removePhoto(p.id, j)}
                    className="absolute -top-1.5 -right-1.5 bg-white border border-[var(--border)] rounded-full w-5 h-5 text-xs text-red-500 grid place-items-center"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <label className="w-14 h-14 border border-dashed border-orange-300 bg-orange-50/50 rounded-lg flex items-center justify-center text-orange-400 text-xl cursor-pointer hover:bg-orange-50 transition">
                +
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(p.id, e)} />
              </label>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <select className="input" value={p.ctaType} onChange={(e) => { patch(p.id, { ctaType: e.target.value as CtaType }); }} onBlur={() => persist(p.id)}>
              <option value="none">No button</option>
              <option value="link">Apply / link</option>
              <option value="text">Text me</option>
            </select>
            {p.ctaType !== "none" && (
              <>
                <input className="input w-28" placeholder="Label" value={p.ctaLabel} onChange={(e) => patch(p.id, { ctaLabel: e.target.value })} onBlur={() => persist(p.id)} />
                <input className="input flex-1" placeholder={p.ctaType === "text" ? "Phone number" : "https://…"} value={p.ctaValue} onChange={(e) => patch(p.id, { ctaValue: e.target.value })} onBlur={() => persist(p.id)} />
              </>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button onClick={addPlan} disabled={busy} className="text-sm brand-text font-medium">
          + Add floor plan
        </button>
        {msg && <span className="text-xs text-[var(--muted)]">{msg}</span>}
      </div>
    </div>
  );
}
