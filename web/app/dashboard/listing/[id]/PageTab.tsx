"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/api";
import type {
  FloorPlan,
  Listing,
  PageConfig,
  PropertyType,
  QuizConfig,
} from "@/lib/types";
import { PROPERTY_TYPES } from "@/lib/types";
import { getPlans } from "@/lib/listing";
import PlansEditor from "./PlansEditor";
import QuizEditor from "./QuizEditor";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function PageTab({
  listing,
  userId,
  onSaved,
}: {
  listing: Listing;
  userId: string;
  onSaved: (patch: Partial<Listing>) => void;
}) {
  const supabase = createClient();
  const cfg0 = (listing.page_config ?? {}) as PageConfig;
  const [enabled, setEnabled] = useState(listing.page_enabled);
  const [slug, setSlug] = useState(
    listing.slug || slugify(listing.address || listing.name || ""),
  );
  const [photos, setPhotos] = useState<string[]>(cfg0.photos ?? []);
  const [agent, setAgent] = useState(cfg0.agent ?? {});
  const [cta, setCta] = useState<NonNullable<PageConfig["cta"]>>(
    cfg0.cta ?? { type: "tour" },
  );
  const [color, setColor] = useState(cfg0.theme?.color ?? "#1a73e8");
  const [quiz, setQuiz] = useState<QuizConfig>(cfg0.quiz ?? {});
  const [plans, setPlans] = useState<FloorPlan[]>(getPlans(cfg0));
  const [propertyType, setPropertyType] = useState<PropertyType>(
    cfg0.property_type ?? "multifamily",
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const publicUrl = `${siteUrl().replace(/\/$/, "")}/p/${slug}`;

  async function upload(file: File, single = false): Promise<string | null> {
    const path = `${userId}/${listing.id}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage
      .from("listing-photos")
      .upload(path, file, { upsert: true });
    if (error) {
      setMsg(error.message);
      return null;
    }
    return supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
  }

  async function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setBusy(true);
    const urls: string[] = [];
    for (const f of files) {
      const u = await upload(f);
      if (u) urls.push(u);
    }
    setPhotos((p) => [...p, ...urls]);
    setBusy(false);
    e.target.value = "";
  }

  async function setAgentPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    const u = await upload(f, true);
    if (u) setAgent((a) => ({ ...a, photo_url: u }));
    setBusy(false);
    e.target.value = "";
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const page_config: PageConfig = {
      photos,
      agent,
      cta,
      theme: { color },
      plans,
      property_type: propertyType,
      // Plans live top-level now; strip any legacy quiz.plans.
      quiz: { ...quiz, plans: undefined },
    };
    const patch = {
      page_enabled: enabled,
      slug: enabled ? slug : listing.slug,
      template: "property",
      page_config,
    };
    const { error } = await supabase.from("listings").update(patch).eq("id", listing.id);
    setBusy(false);
    if (error) {
      setMsg(
        error.code === "23505"
          ? "That page URL is taken — try a different slug."
          : error.message,
      );
      return;
    }
    onSaved(patch as Partial<Listing>);
    setMsg("Saved.");
  }

  return (
    <div className="card p-6 space-y-4 max-w-xl">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="accent-violet-600 w-4 h-4"
        />
        Publish public property page
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
        <span className="text-xs text-[var(--muted)]">Page URL</span>
        <div className="flex items-center gap-1 text-sm mt-1">
          <span className="text-[var(--muted)]">/p/</span>
          <input
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className="input flex-1"
            placeholder="123-main-st"
          />
        </div>
        {enabled && slug && (
          <div className="mt-1.5 text-xs text-[var(--muted)] flex items-center gap-2">
            <a href={publicUrl} target="_blank" rel="noreferrer" className="brand-text font-medium truncate">
              {publicUrl}
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(publicUrl)}
              className="brand-text font-medium"
            >
              Copy
            </button>
          </div>
        )}
      </label>

      <div>
        <span className="text-xs text-[var(--muted)]">Photos</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {photos.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-16 h-16 object-cover rounded-xl border border-[var(--border)]" />
              <button
                onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 bg-white border border-[var(--border)] shadow-sm rounded-full w-5 h-5 text-xs text-red-500 grid place-items-center"
              >
                ✕
              </button>
            </div>
          ))}
          <label className="w-16 h-16 border border-dashed border-violet-300 bg-violet-50/50 rounded-xl flex items-center justify-center text-violet-400 text-xl cursor-pointer hover:bg-violet-50 transition">
            +
            <input type="file" accept="image/*" multiple onChange={addPhotos} className="hidden" />
          </label>
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-4 space-y-2">
        <span className="text-xs font-semibold text-[var(--muted)]">Agent</span>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Name" value={agent.name ?? ""} onChange={(e) => setAgent({ ...agent, name: e.target.value })} className="input" />
          <input placeholder="Phone" value={agent.phone ?? ""} onChange={(e) => setAgent({ ...agent, phone: e.target.value })} className="input" />
          <input placeholder="Email" value={agent.email ?? ""} onChange={(e) => setAgent({ ...agent, email: e.target.value })} className="input col-span-2" />
        </div>
        <label className="text-xs text-[var(--muted)] flex items-center gap-2">
          Photo:
          <input type="file" accept="image/*" onChange={setAgentPhoto} className="text-xs" />
          {agent.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agent.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          )}
        </label>
      </div>

      <div className="border-t border-[var(--border)] pt-4 space-y-2">
        <span className="text-xs font-semibold text-[var(--muted)]">
          Primary button (besides the tour form)
        </span>
        <div className="flex gap-2 items-center">
          <select
            value={cta.type}
            onChange={(e) =>
              setCta({ ...cta, type: e.target.value as "tour" | "text" | "link" })
            }
            className="input"
          >
            <option value="tour">Tour form only</option>
            <option value="text">Text me</option>
            <option value="link">External link</option>
          </select>
          {cta.type !== "tour" && (
            <input
              placeholder={cta.type === "text" ? "Phone number" : "https://…"}
              value={cta.value ?? ""}
              onChange={(e) => setCta({ ...cta, value: e.target.value })}
              className="input flex-1"
            />
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        Accent color
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 border border-[var(--border)] rounded-lg cursor-pointer" />
      </label>

      <PlansEditor
        initialPlans={getPlans(cfg0)}
        onChange={setPlans}
        upload={(f) => upload(f)}
      />

      <QuizEditor initialQuiz={cfg0.quiz ?? {}} plans={plans} onChange={setQuiz} />

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : "Save page"}
        </button>
        {msg && <span className="text-sm text-[var(--muted)]">{msg}</span>}
      </div>
    </div>
  );
}
